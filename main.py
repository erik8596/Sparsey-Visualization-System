from src.web.app import create_app
import os

def create_wandb_artifact_landing_pad():
    DATA_ARTIFACT_STORE_PATH="data/artifact_store"
    os.makedirs(DATA_ARTIFACT_STORE_PATH, exist_ok=True)

def main():
    app = create_app(os.environ.get('FLASK_ENV'))
    create_wandb_artifact_landing_pad()
    app.run(
        port=int(os.environ.get('FLASK_PORT', 5000)),
        debug=os.environ.get('FLASK_DEBUG', True)
    )

if __name__ == "__main__":
    main()
