from src.web.app import create_app
import os

DATA_ARTIFACT_STORE_PATH=os.environ.get(
    'DATA_ARTIFACT_STORE_PATH', 
    "data/artifact_store"
)

def check_wandb_artifact_landing_pad():
    if not os.path.exists(f"{DATA_ARTIFACT_STORE_PATH}"):
        # create the directory if it doesn't exist
        os.makedirs(f"{DATA_ARTIFACT_STORE_PATH}", exist_ok=True)

def main():
    app = create_app(os.environ.get('FLASK_ENV'))
    check_wandb_artifact_landing_pad()
    app.run(
        port=int(os.environ.get('FLASK_PORT', 5000)),
        debug=os.environ.get('FLASK_DEBUG', True)
    )

if __name__ == "__main__":
    main()
