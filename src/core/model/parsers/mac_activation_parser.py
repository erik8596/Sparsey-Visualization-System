# src/core/model/parsers/mac_activation_parser.py

import re
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class MACActivationParser:
    """
    Parser for MAC activations, supporting both:
      - legacy summary-based proportions (num_activations)
      - history-based binary flags (neuron_activations)
    """

    def __init__(self):
        # Legacy summary pattern (proportion of active neurons)
        self._summ_pattern = re.compile(r"^num_activations/layer_(\d+)/mac_(\d+)$")
        # History pattern for true on/off flags per MAC
        self._hist_pattern = re.compile(r"^neuron_activations/layer_(\d+)/mac_(\d+)$")

    def parse(self, summary_data: Dict[str, Any]) -> Dict[str, Dict[int, int]]:
        """
        Parse summary-based MAC activation proportions.

        Returns a mapping:
          {
            "layer_1": { 0: 0, 1: 1, 2: 0, … },
            "layer_2": { … }
          }
        where values are int(proportion) (floored to 0 or 1).
        """
        mac_acts: Dict[str, Dict[int, int]] = {}
        try:
            for key, val in summary_data.items():
                match = self._summ_pattern.match(key)
                if not match:
                    continue
                layer_idx, mac_idx = match.groups()
                layer = f"layer_{layer_idx}"
                idx   = int(mac_idx)
                # cast proportion to int (0 or >0 → 1)
                mac_acts.setdefault(layer, {})[idx] = 1 if float(val) > 0 else 0
        except Exception as e:
            logger.error(f"Error parsing summary-based MAC activations: {e}")
        return mac_acts

    def parse_from_history(
        self,
        history: Dict[int, Dict[str, Any]],
        step: int = None
    ) -> Dict[str, Dict[int, int]]:
        """
        Extract binary MAC activation flags from per-step history.

        Looks for keys:
          "neuron_activations/layer_<L>/mac_<M>" → value 0 or 1

        Args:
          history: mapping of step index → metrics dict
          step:    specific step to use; if None, uses the smallest key

        Returns:
          {
            "layer_1": { 0: 0, 1: 1, 2: 0, … },
            "layer_2": { … }
          }
        """
        try:
            if not history:
                return {}

            chosen_step = step if step is not None else min(history.keys())
            step_data   = history.get(chosen_step, {})

            mac_map: Dict[str, Dict[int, int]] = {}
            for key, val in step_data.items():
                match = self._hist_pattern.match(key)
                if not match:
                    continue
                layer_idx, mac_idx = match.groups()
                layer = f"layer_{layer_idx}"
                idx   = int(mac_idx)
                # val is typically 0 or 1
                mac_map.setdefault(layer, {})[idx] = 1 if val else 0

            return mac_map

        except Exception as e:
            logger.error(f"Error parsing history-based MAC activations at step {step}: {e}")
            return {}
