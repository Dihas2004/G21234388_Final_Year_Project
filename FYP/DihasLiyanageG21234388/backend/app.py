from flask import Flask
from flask_cors import CORS
from routes import api_blueprint

app = Flask(__name__)
CORS(app)

# Register routes from routes.py
app.register_blueprint(api_blueprint)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
