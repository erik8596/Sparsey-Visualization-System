from typing import Dict, Any
from dataclasses import dataclass, field
import re
from logging import getLogger

logger = getLogger(__name__)

@dataclass
class ModelConfig:
    """Data class for model configuration structure."""
    layers: Dict[str, Any] = field(default_factory=dict)
    input_dimensions: Dict[str, int] = field(default_factory=dict)
    mac_activations: Dict[str, Dict[int, int]] = field(default_factory=dict)

    def _extract_model_config(self, run: Any) -> Dict[str, Any]:
        """Extract and validate model configuration from run."""
        config = getattr(run, "config", {}).get("model", {}).get("layers", {})
        if not config:
            raise ValueError(f"No layers found in WandB run {run.id}")
        return config

    def _get_input_dimensions(self, model_config: Dict[str, Any]) -> Dict[str, int]:
        """Extract input dimensions from layer 1 configuration."""
        layer_1_params = model_config.get("layer_1", {}).get("params", {})
        width = layer_1_params.get("prev_layer_mac_grid_num_cols")
        height = layer_1_params.get("prev_layer_mac_grid_num_rows")
        
        if not (width and height):
            raise ValueError("Missing input dimensions in layer 1 configuration")
            
        return {"width": width, "height": height}

    def _parse_mac_activations(self, summary_data: Dict[str, Any]) -> Dict[str, Dict[int, int]]:
        """
        Parse MAC activations from summary data.
        
        Args:
            summary_data: Raw summary data from W&B run
            
        Returns:
            Dictionary mapping layer names to MAC activation states
        """
        mac_activations: Dict[str, Dict[int, int]] = {}
        activation_pattern = re.compile(r"^num_activations/layer_(\d+)/mac_(\d+)$")
        
        for key, value in summary_data.items():
            if match := activation_pattern.match(key):
                layer_idx, mac_idx = match.groups()
                layer_name = f"layer_{layer_idx}"
                
                # Initialize layer dict if needed
                if layer_name not in mac_activations:
                    mac_activations[layer_name] = {}
                
                # Store MAC activation state
                mac_activations[layer_name][int(mac_idx)] = int(value)
        
        return mac_activations

    def get_model_config(self, run) -> 'ModelConfig':
        """
        Fetch and process model configuration and input dimensions.
        
        Args:
            run: ID of the run to fetch
            
        Returns:
            ModelConfig object containing layers, input dimensions, and MAC activations
            
        Raises:
            ValueError: If no layers found in the run configuration
        """
        try:

            # Extract and validate model configuration
            model_config = self._extract_model_config(run)
            
            # Get MAC activations from summary data
            mac_activations = self._parse_mac_activations(getattr(run, "summary", {}))
            
            # Extract input dimensions
            input_dimensions = self._get_input_dimensions(model_config)
            
            return ModelConfig(
                layers=model_config,
                input_dimensions=input_dimensions,
                mac_activations=mac_activations
            )
            
        except Exception as e:
            logger.error(f"Error fetching model config for run {run.id}: {str(e)}")
            raise ValueError(f"Failed to fetch model configuration: {str(e)}")

