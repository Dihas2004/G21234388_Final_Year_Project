from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import shap
import pickle
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import base64

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return "Hello, Flask!"

@app.route("/upload", methods=["POST"])
def upload_files():
    # Handles file uploads and trains the model without saving CSV files.
    if "files" not in request.files:
        return jsonify({"error": "No file part"}), 400

    files = request.files.getlist("files")
    target_variable = request.form.get("prediction_variable")
    if not files or not target_variable:
        return jsonify({"error": "Missing files or prediction variable"}), 400

    # Read CSV files directly from the file streams into DataFrames
    dfs = []
    for file in files:
        df = pd.read_csv(file)
        dfs.append(df)

    results = train_model(dfs, target_variable)
    return jsonify(results)

def train_model(dfs, target_variable):
    """
    Loads CSVs (as DataFrames), trains the model, extracts SHAP dependence data,
    and computes PDP coordinates for each selected feature and each class.
    Returns a JSON containing accuracy, classification report, both SHAP and PDP plots,
    and a base64-encoded pickle (.pkl) representation of the trained model.
    """
    # Merge the DataFrames.
    merged_df = dfs[0]
    for df in dfs[1:]:
        if "Date" in df.columns:
            merged_df = merged_df.merge(df, on="Date", how="inner")
        else:
            merged_df = pd.concat([merged_df, df], axis=1)
    if target_variable not in merged_df.columns:
        return {"error": f"Target variable '{target_variable}' not found in dataset"}

    # Shift target (predict next value) and drop missing rows
    merged_df[target_variable] = merged_df[target_variable].shift(-1)
    merged_df = merged_df.dropna().reset_index(drop=True)

    X = merged_df.drop(columns=["Date", target_variable], errors="ignore")
    y = merged_df[target_variable]
    y_adjusted = y - 1  # shift classes from 1..3 to 0..2

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_adjusted, test_size=0.2, random_state=42, stratify=y_adjusted
    )

    # Train initial model using ExtraTreesClassifier
    model = ExtraTreesClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # Perform SHAP feature selection for ranking all features
    selected_features, shap_values = shap_feature_selection(model, X_train, top_n=len(X_train.columns))
    
    print("Training ExtraTreesClassifier using all features...")
    model.fit(X_train, y_train)
    y_pred_adjusted = model.predict(X_test)
    y_pred = y_pred_adjusted + 1  # shift back to 1..3

    accuracy = accuracy_score(y_test + 1, y_pred)
    report = classification_report(y_test + 1, y_pred, output_dict=True)

    # Pickle and encode the model directly (without saving to disk)
    model_bytes = pickle.dumps(model)
    model_b64 = base64.b64encode(model_bytes).decode("utf-8")

    # Build SHAP plot data structure
    shap_plot_data = {
        "target_variable": target_variable,
        "plots": []
    }

    # Loop over model’s classes instead of hardcoding [0,1,2]
    class_indices = range(len(model.classes_))
    if shap_values is not None:
        for class_idx in class_indices:
            class_data = get_shap_dependence_data(shap_values, X_train, selected_features, class_idx)
            shap_plot_data["plots"].append({
                "class_index": class_idx + 1,
                "class_name": f"{target_variable} - Class {class_idx + 1}",
                "data": class_data
            })

    # Build PDP plot data structure
    pdp_plot_data = {
        "target_variable": target_variable,
        "plots": []
    }
    # Loop over model’s classes instead of hardcoding [0,1,2]
    for class_idx in class_indices:
        class_pdp = {
            "class_index": class_idx + 1,
            "class_name": f"{target_variable} - Class {class_idx + 1}",
            "data": []
        }
        for feature in selected_features:
            # Compute PDP coordinates and snap them to whole numbers.
            x_grid, y_avg = get_pdp_data(model, X_train, feature, target_class=class_idx, grid_resolution=50)
            x_snapped, y_snapped = snap_coords_to_whole(x_grid, y_avg)
            class_pdp["data"].append({
                "feature": feature,
                "x": x_snapped,
                "y": y_snapped
            })
        pdp_plot_data["plots"].append(class_pdp)

    return {
        "message": "Training complete!",
        "accuracy": accuracy,
        "classification_report": report,
        "shap_plots": shap_plot_data,
        "pdp_plots": pdp_plot_data,
        "model_pkl_b64": model_b64
    }

def get_pdp_data(model, X, feature, target_class, grid_resolution=50):
    """
    Computes PDP coordinates for a given feature and target class.
    For each value in a grid (between the 5th and 95th percentile),
    set that feature to the grid value, compute the predicted probability
    for the given class, and average over the dataset.
    """
    x_min = np.percentile(X[feature], 5)
    x_max = np.percentile(X[feature], 95)
    x_vals = np.linspace(x_min, x_max, grid_resolution)
    pdp_vals = []
    X_temp = X.copy()
    for val in x_vals:
        X_temp[feature] = val
        prob = model.predict_proba(X_temp)[:, target_class].mean()
        pdp_vals.append(prob)
    return x_vals.tolist(), pdp_vals

def snap_coords_to_whole(x_vals, y_vals):
    """
    "Snaps" x values to the nearest whole number. For each unique whole number,
    chooses the (x, y) pair whose x is closest to that integer.
    Returns two lists: snapped x values (whole numbers) and corresponding y values.
    """
    snapped = {}
    for x, y in zip(x_vals, y_vals):
        rounded = round(x)
        diff = abs(x - rounded)
        if rounded not in snapped or diff < snapped[rounded][2]:
            snapped[rounded] = (x, y, diff)
    sorted_keys = sorted(snapped.keys())
    snapped_x = [key for key in sorted_keys]
    snapped_y = [snapped[key][1] for key in sorted_keys]
    return snapped_x, snapped_y

def shap_feature_selection(model, X_train, top_n=8):
    try:
        explainer = shap.Explainer(model, X_train)
        shap_values = explainer(X_train)
        vals = shap_values.values
        print(f"    Debug: SHAP values shape: {vals.shape}")
        n_features = X_train.shape[1]
        if vals.ndim == 3:
            if vals.shape[1] == n_features:
                mean_shap_values = np.mean(np.abs(vals), axis=(0, 2))
            elif vals.shape[2] == n_features:
                mean_shap_values = np.mean(np.abs(vals), axis=(0, 1))
            else:
                print(f" Unrecognized SHAP shape: {vals.shape}. Skipping SHAP selection.")
                return X_train.columns.tolist(), shap_values
        else:
            mean_shap_values = np.mean(np.abs(vals), axis=0)
        mean_shap_values = np.array(mean_shap_values).flatten()
        if len(mean_shap_values) != n_features:
            print(f" SHAP dimension mismatch: {len(mean_shap_values)} vs {n_features}. Skipping SHAP selection.")
            return X_train.columns.tolist(), shap_values
        shap_importance = pd.DataFrame({
            "Feature": X_train.columns,
            "SHAP Value": mean_shap_values
        }).sort_values(by="SHAP Value", ascending=False)
        selected_features = shap_importance.head(top_n)["Feature"].tolist()
        print(f"\n SHAP Analysis - Selecting top {top_n} features: {selected_features}")
        return selected_features, shap_values
    except Exception as e:
        print(f" SHAP feature selection failed: {e}")
        return X_train.columns.tolist(), None

def get_shap_dependence_data(shap_values, X_train, selected_features, class_index):
    """
    Extracts x and y coordinates for a SHAP dependence plot for each selected feature.
    Returns a list of dictionaries containing:
      - feature: The feature name.
      - x: List of feature values.
      - y: List of corresponding SHAP values.
    """
    data = []
    shap_values_array = shap_values.values
    if shap_values_array.ndim == 3:
        print(f"Multi-class SHAP detected. Extracting SHAP for class {class_index}.")
        shap_class_values = shap_values_array[:, :, class_index]
    else:
        shap_class_values = shap_values_array
    for feature in selected_features:
        try:
            feature_index = list(shap_values.feature_names).index(feature)
        except ValueError:
            print(f"Feature {feature} not found in shap_values.feature_names.")
            continue
        feature_x = X_train[feature].tolist()
        feature_y = shap_class_values[:, feature_index].tolist()
        data.append({
            "feature": feature,
            "x": feature_x,
            "y": feature_y
        })
    return data

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
