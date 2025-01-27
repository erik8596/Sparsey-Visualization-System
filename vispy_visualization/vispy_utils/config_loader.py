import yaml
import os

def load_config():
    file_path = "/home/ryumakiguchi/code/ryumakiguchi/Sparsey/sparseypy_visualizer/visualization_threejs/configs/network.yaml"

    print(f"Looking for config at: {file_path}")
    print(f"Absolute path check: {os.path.abspath(file_path)}")

    if not os.path.exists(file_path):
        print("File not found error triggered!")
        raise FileNotFoundError(f"Configuration file {file_path} not found.")

    print("File found! Proceeding to read...")

    with open(file_path, "r") as file:
        config = yaml.safe_load(file)

    if "layers" not in config:
        raise KeyError("Missing 'layers' section in network.yaml")

    print("Config successfully loaded!")
    return config["layers"]
