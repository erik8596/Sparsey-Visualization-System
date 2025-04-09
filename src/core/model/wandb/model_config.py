from typing import Dict, Any, List
from dataclasses import dataclass, field
import logging
from src.core.model.parsers.neuron_activation_parser import NeuronActivationParser
from src.core.model.parsers.mac_activation_parser import MACActivationParser
from src.core.model.parsers.input_activation_parser import InputActivationParser

logger = logging.getLogger(__name__)

@dataclass
class ModelConfig:
    """Data class for model configuration structure."""
    layers: Dict[str, Any] = field(default_factory=dict)
    input_dimensions: Dict[str, int] = field(default_factory=dict)
    mac_activations: Dict[str, Dict[int, int]] = field(default_factory=dict)
    neuron_activations: Dict[str, Dict[int, Dict[int, Dict[int, List[float]]]]] = field(default_factory=dict)
    input_activations: Dict[int, int] = field(default_factory=dict)

    def _extract_model_config(self, run: Any) -> Dict[str, Any]:
        """Extract and validate model configuration from run."""
        try:
            config = getattr(run, "config", {})
            if isinstance(config, str):
                # Handle case where config is a string
                import json
                config = json.loads(config)

            model_config = config.get("model", {}).get("layers", {})
            if not model_config:
                raise ValueError(f"No layers found in WandB run {run.id}")

            # print("\n=== Raw Model Config ===")
            # print(model_config)
            # print("===================================\n")

            return model_config

        except Exception as e:
            raise ValueError(f"Failed to fetch model configuration: {str(e)}")

    def _get_input_dimensions(self, model_config: Dict[str, Any]) -> Dict[str, int]:
        """Extract input dimensions from layer 1 configuration."""
        layer_1_params = model_config.get("layer_1", {}).get("params", {})
        width = layer_1_params.get("prev_layer_mac_grid_num_cols")
        height = layer_1_params.get("prev_layer_mac_grid_num_rows")

        if not (width and height):
            raise ValueError("Missing input dimensions in layer 1 configuration")

        return {"width": width, "height": height}

    def get_model_config(self, run) -> 'ModelConfig':
        """Fetch and process model configuration, input dimensions, and activations."""
        try:
            model_config = self._extract_model_config(run)
            summary_data = getattr(run, "summary", {})

            # Use parsers to get activation data
            mac_parser = MACActivationParser()
            neuron_parser = NeuronActivationParser()
            input_parser = InputActivationParser()

            mac_activations = mac_parser.parse(summary_data)
            neuron_activations = neuron_parser.parse_from_history(run)
            input_activations = input_parser.parse(summary_data)

            input_dimensions = self._get_input_dimensions(model_config)

            return ModelConfig(
                layers=model_config,
                input_dimensions=input_dimensions,
                mac_activations=mac_activations,
                neuron_activations=neuron_activations,
                input_activations=input_activations
            )

        except Exception as e:
            logger.error(f"Error fetching model config for run {run.id}: {str(e)}")
            print(f"Full error: {str(e)}")
            return ModelConfig()
