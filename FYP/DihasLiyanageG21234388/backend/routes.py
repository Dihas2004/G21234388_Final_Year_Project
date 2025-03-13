from flask import Blueprint, request, jsonify
import pandas as pd
from training import train_model

api_blueprint = Blueprint("api", __name__)

@api_blueprint.route("/")
def home():
    return "Hello, Flask!"

@api_blueprint.route("/upload", methods=["POST"])
def upload_files():
    # Check for files and the target variable in the request.
    if "files" not in request.files:
        return jsonify({"error": "No file part"}), 400

    files = request.files.getlist("files")
    target_variable = request.form.get("prediction_variable")
    if not files or not target_variable:
        return jsonify({"error": "Missing files or prediction variable"}), 400

    # Read CSV files directly from the file streams into DataFrames.
    dfs = []
    for file in files:
        df = pd.read_csv(file)
        dfs.append(df)

    # Call the training function
    results = train_model(dfs, target_variable)
    return jsonify(results)
