from flask import Blueprint, request, jsonify
import pandas as pd
from training import train_model

# Create a new Flask Blueprint named "api" to organize routes related to this API.
api_blueprint = Blueprint("api", __name__)

# Define a route for the home page. When accessed, it returns a simple greeting.
@api_blueprint.route("/")
def home():
    return "Hello, Flask!"

# Define a route for uploading files. This route accepts only POST requests.
@api_blueprint.route("/upload", methods=["POST"])
def upload_files():
    # Check for files and the target variable in the request.
    if "files" not in request.files:
        return jsonify({"error": "No file part"}), 400

    # Retrieve the list of files from the request.
    files = request.files.getlist("files")

    # Get the prediction variable from the form data.
    target_variable = request.form.get("prediction_variable")

    # If either the files or the target variable is missing, return an error response.
    if not files or not target_variable:
        return jsonify({"error": "Missing files or prediction variable"}), 400

    # Read CSV files directly from the file streams into DataFrames.
    dfs = []

    # Iterate over each uploaded file and read it into a DataFrame using pandas.
    for file in files:
        df = pd.read_csv(file)
        dfs.append(df)

    # Call the training function
    results = train_model(dfs, target_variable)

    # Return the results from the training function as a JSON response.
    return jsonify(results)
