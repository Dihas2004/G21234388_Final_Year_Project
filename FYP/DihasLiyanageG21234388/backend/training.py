import pandas as pd
import shap
import pickle
import numpy as np
import base64
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from utils import (
    get_pdp_data,
    snap_coords_to_whole,
    shap_feature_selection,
    get_shap_dependence_data
)

def train_model(dfs, target_variable):
    """
    Loads CSVs (as DataFrames), trains the model, extracts SHAP dependence data,
    and computes PDP coordinates for each selected feature and each class.
    Returns a JSON containing accuracy, classification report, both SHAP and PDP plots,
    and a base64-encoded pickle representation of the trained model.
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
    y_adjusted = y - 1  # Adjust classes from 1..3 to 0..2

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_adjusted, test_size=0.2, random_state=42, stratify=y_adjusted
    )

    # Train initial model using ExtraTreesClassifier
    model = ExtraTreesClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # Perform SHAP feature selection for ranking all features
    selected_features, shap_values = shap_feature_selection(model, X_train, top_n=len(X_train.columns))
    
    # Train using all features
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

    # Loop over model’s classes dynamically
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
