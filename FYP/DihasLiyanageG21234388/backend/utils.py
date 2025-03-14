import numpy as np
import pandas as pd
import shap

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
    # Work on a copy to avoid modifying original data
    X_temp = X.copy()
    for val in x_vals:
        # Replace feature with grid value
        X_temp[feature] = val
        # Compute average probability
        prob = model.predict_proba(X_temp)[:, target_class].mean()
        pdp_vals.append(prob)
    return x_vals.tolist(), pdp_vals

def snap_coords_to_whole(x_vals, y_vals):
    """
    Snaps x values to the nearest whole number. For each unique whole number,
    chooses the (x, y) pair whose x is closest to that integer.
    Returns two lists: snapped x values and corresponding y values.
    """
    snapped = {}
    for x, y in zip(x_vals, y_vals):
        rounded = round(x)
        diff = abs(x - rounded)
        # Keep the pair with smallest difference for each rounded value
        if rounded not in snapped or diff < snapped[rounded][2]:
            snapped[rounded] = (x, y, diff)
    sorted_keys = sorted(snapped.keys())
    snapped_x = [key for key in sorted_keys]
    snapped_y = [snapped[key][1] for key in sorted_keys]
    return snapped_x, snapped_y

def shap_feature_selection(model, X_train, top_n=8):
    """
    Performs SHAP feature selection by computing mean absolute SHAP values.
    Returns the top n selected features and the computed SHAP values.
    """
    try:
        explainer = shap.Explainer(model, X_train)
        shap_values = explainer(X_train)
        vals = shap_values.values
        n_features = X_train.shape[1]
        if vals.ndim == 3:
            # Handle multi-dimensional outputs for multi-class models
            if vals.shape[1] == n_features:
                mean_shap_values = np.mean(np.abs(vals), axis=(0, 2))
            elif vals.shape[2] == n_features:
                mean_shap_values = np.mean(np.abs(vals), axis=(0, 1))
            else:
                print(f"Unrecognized SHAP shape: {vals.shape}. Skipping SHAP selection.")
                return X_train.columns.tolist(), shap_values
        else:
            mean_shap_values = np.mean(np.abs(vals), axis=0)
        mean_shap_values = np.array(mean_shap_values).flatten()
        # Check if computed SHAP values match the number of features
        if len(mean_shap_values) != n_features:
            print(f"SHAP dimension mismatch: {len(mean_shap_values)} vs {n_features}. Skipping SHAP selection.")
            return X_train.columns.tolist(), shap_values
        shap_importance = pd.DataFrame({
            "Feature": X_train.columns,
            "SHAP Value": mean_shap_values
        }).sort_values(by="SHAP Value", ascending=False)
        selected_features = shap_importance.head(top_n)["Feature"].tolist()
        print(f"\nSHAP Analysis - Selecting top {top_n} features: {selected_features}")
        return selected_features, shap_values
    except Exception as e:
        print(f"SHAP feature selection failed: {e}")
        return X_train.columns.tolist(), None

def get_shap_dependence_data(shap_values, X_train, selected_features, class_index):
    """
    Extracts x and y coordinates for a SHAP dependence plot for each selected feature.
    Returns a list of dictionaries containing feature name and corresponding SHAP values.
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
