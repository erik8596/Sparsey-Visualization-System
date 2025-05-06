import torch
import numpy as np
from typing import Tuple, Dict, Any, Union
import pprint
from src.core.model.wandb.wandb_facade import WandBFacade

# type alias for the nested dictionary structure
ProbabilityDict = Dict[int, Dict[str, Dict[str, Dict[str, Dict[str, float]]]]]

class ActivationProbabilitiesParser:
    """
    Parser for activation probabilities from WandB history.
    Applies softmax normalization across neurons within each CM.
    """
    def __init__(self, wbf: WandBFacade) -> None:
        self.wbf = wbf
        self.history = self.wbf.fetch_run_history()
        self.parsed_probabilities: ProbabilityDict = {}

    def _apply_softmax_to_cm(self, neuron_dict: Dict[str, float]) -> Dict[str, float]:
        """Applies softmax to the probabilities within a single CM's neuron dictionary."""
        if not neuron_dict: 
            return {}

        neuron_keys = list(neuron_dict.keys())
        raw_probabilities_list = [neuron_dict[key] for key in neuron_keys]
        
        if not raw_probabilities_list:
             return {}

        raw_probabilities_tensor = torch.tensor(raw_probabilities_list, dtype=torch.float16)

        softmax_probabilities_tensor = torch.softmax(raw_probabilities_tensor, dim=0)

        softmaxed_neuron_dict = {
            key: prob.item()
            for key, prob in zip(neuron_keys, softmax_probabilities_tensor)
        }
        return softmaxed_neuron_dict
    
    def parse(self) -> ProbabilityDict:
        """
        Parse activation probabilities from WandB history and apply softmax per CM.

        Returns:
            ProbabilityDict: 
                A nested dictionary structured as {step: {'layer_x': {'mac_m': {'cm_c': {'neuron_n': softmax_probability}}}}}.
        """
        if not self.history:
            print("History not loaded. Fetching history...")
            self.history = self.wbf.fetch_run_history()
            if not self.history:
                print("Failed to fetch history.")
                return {}

        raw_parsed_data: ProbabilityDict = {}
        for step, metrics_dict in self.history.items():
            if not isinstance(metrics_dict, dict):
                # print(f"Warning: Invalid data format for step {step}. Expected dict, got {type(metrics_dict)}. Skipping.")
                continue
                
            raw_parsed_data[step] = {}
            for key, value in metrics_dict.items():
                if key.startswith("activation_probabilities/"):
                    parts = key.split('/')
                    if len(parts) == 5:
                        try:
                            layer_idx = int(parts[1].split('_')[1])
                            mac_idx = int(parts[2].split('_')[1])
                            cm_idx = int(parts[3].split('_')[1])
                            neuron_idx = int(parts[4].split('_')[1])

                            layer_key = f'layer_{layer_idx}'
                            mac_key = f'mac_{mac_idx}'
                            cm_key = f'cm_{cm_idx}'
                            neuron_key = f'neuron_{neuron_idx}'
                            
                            if layer_key not in raw_parsed_data[step]:
                                raw_parsed_data[step][layer_key] = {}
                            if mac_key not in raw_parsed_data[step][layer_key]:
                                raw_parsed_data[step][layer_key][mac_key] = {}
                            if cm_key not in raw_parsed_data[step][layer_key][mac_key]:
                                raw_parsed_data[step][layer_key][mac_key][cm_key] = {}

                            try:
                                prob_value = float(value)
                            except (ValueError, TypeError):
                                print(f"Warning: Could not convert value '{value}' to float for key '{key}' at step {step}. Skipping neuron.")
                                continue
                            
                            raw_parsed_data[step][layer_key][mac_key][cm_key][neuron_key] = prob_value

                        except (IndexError, ValueError, TypeError) as e:
                            # print(f"Warning: Could not parse metric key '{key}' for step {step}: {e}")
                            continue
                    pass

        softmaxed_data: ProbabilityDict = {}
        for step, layer_data in raw_parsed_data.items():
            softmaxed_data[step] = {}
            for layer_key, mac_data in layer_data.items():
                softmaxed_data[step][layer_key] = {}
                for mac_key, cm_data in mac_data.items():
                    softmaxed_data[step][layer_key][mac_key] = {}
                    for cm_key, neuron_dict in cm_data.items():
                        # apply softmax to CM neuron dict
                        softmaxed_data[step][layer_key][mac_key][cm_key] = self._apply_softmax_to_cm(neuron_dict)

        self.parsed_probabilities = softmaxed_data
        return self.parsed_probabilities
    
    def get_step_probabilities(self, step: int) -> Dict[str, float]:
        """
        Get activation probabilities for a specific step.
        """
        return self.parsed_probabilities[step]



        
        