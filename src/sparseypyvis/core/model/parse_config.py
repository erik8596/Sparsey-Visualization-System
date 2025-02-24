from typing import Dict, Any
import yaml, json
from dataclasses import dataclass, field
from src.sparseypyvis.core.model.model_composite import ModelComponent, CompositeComponent
from src.sparseypyvis.core.model.model import Model
from src.sparseypyvis.core.model.layer import Layer
from src.sparseypyvis.core.model.mac import MAC
from src.sparseypyvis.core.model.neuron import Neuron

@dataclass
class ModelConfigParser:
    config: dict = field(default_factory=dict)

    def parse(self) -> Model:
        model = Model()  # TODO: Will need to pass args

        # parse layers
        layers_config = self.config.get('layers', [])
        for layer_idx, layer_config in enumerate(layers_config):
            layer = self._parse_layer(layer_idx, layer_config)
            model.add(layer)
        return model
    
    def _parse_layer(self, layer_idx: int, layer_config: dict) -> Layer:
        layer = Layer(f"layer_{layer_idx}")

        # parse coding fields (macs) in layer
        macs_config = layer_config.get('num_macs', [])
