import yaml

def load_network_config(filepath):
    """Loads and parses a YAML configuration file."""
    with open(filepath, 'r') as file:
        return yaml.safe_load(file)
