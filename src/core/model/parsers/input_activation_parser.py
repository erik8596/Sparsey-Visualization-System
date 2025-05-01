import re
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class InputActivationParser:
    """Parser for input-layer activations, supporting both summary- and history-based extraction."""

    def __init__(self):
        # Logger for this parser
        self.logger = logger
        # Pattern to match history keys like "input_activations/pixel_<index>"
        self._hist_pattern = re.compile(r"^input_activations/pixel_(\d+)$")
        # (Optional) Legacy summary pattern, still here for backward compatibility
        self._summ_pattern = re.compile(r"^num_activations/layer_0/mac_(\d+)$")

    def parse(self, summary_data: Dict[str, Any]) -> Dict[int, int]:
        """
        (Legacy) Parse input-layer MAC activations from WandB summary.

        Args:
            summary_data: WandB summary dict with keys like "num_activations/layer_0/mac_<N>"

        Returns:
            Mapping MAC index → activation count (int)
        """
        input_acts: Dict[int, int] = {}
        try:
            for key, val in summary_data.items():
                m = self._summ_pattern.match(key)
                if m:
                    idx = int(m.group(1))
                    input_acts[idx] = int(val)
        except Exception as e:
            self.logger.error(f"Error parsing summary-based input activations: {e}")
        return input_acts

    def parse_from_history(
        self,
        history: Dict[int, Dict[str, Any]],
        step: int = None
    ) -> Dict[int, int]:
        """
        Parse input-layer pixel activations from a WandB history mapping.

        Args:
            history:  Dict mapping step indices → metric dicts
            step:     Specific step to use; if None, uses the first (min) step

        Returns:
            Mapping pixel index → activation (0 or 1)
        """
        try:
            if not history:
                return {}

            # Choose step 0 by default (or provided)
            chosen_step = step if step is not None else min(history.keys())
            step_data = history.get(chosen_step, {})

            pixel_map: Dict[int, int] = {}
            for key, val in step_data.items():
                m = self._hist_pattern.match(key)
                if m:
                    idx = int(m.group(1))
                    pixel_map[idx] = 1 if val else 0

            return pixel_map

        except Exception as e:
            self.logger.error(
                f"Error parsing history-based input activations at step {step}: {e}"
            )
            return {}