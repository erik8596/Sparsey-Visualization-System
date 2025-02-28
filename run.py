from src.sparseypyvis.web.app import create_app
import os

if __name__ == "__main__":
    app = create_app()
    app.run(
        debug=True, 
        port=int(os.getenv("FLASK_RUN_PORT", 5000))
    )

