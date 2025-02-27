from visualization_threejs.server import app
import os

if __name__ == "__main__":
    app.run(debug=True, port=os.getenv("FLASK_RUN_PORT", 5000))

