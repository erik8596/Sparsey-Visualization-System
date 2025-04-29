import re
from typing import Dict
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class InputActivationParser:
    """Parser specifically for input layer activations from WandB summary data or history"""

    def __init__(self):
        self.pattern = re.compile(r"^input_activations/pixel_(\d+)$")

    def parse(self, summary_data: Dict[str, any]) -> Dict[int, int]:
        """Parse input layer MAC activations from summary (potentially outdated)"""
        try:
            input_activations = {}

            for key, value in summary_data.items():
                if match := self.pattern.match(key):
                    mac_idx = int(match.group(1))
                    input_activations[mac_idx] = int(value)

            return input_activations

        except Exception as e:
            logger.error(f"Error parsing input layer activations from summary: {e}")
            return {}

    def parse_from_history(self, run) -> Dict[int, int]:
        """
        Parse input activations from the latest step in history data.
        Returns data in format:
        {
            1: 0,  # pixel 1 is inactive
            2: 1   # pixel 2 is active
        }
        """
        try:
            # Get history data
            history = run.scan_history()
            df = pd.DataFrame(history)

            if df.empty:
                logger.warning("No history data available for input activations")
                return {}

            # Find columns matching input activations pattern
            input_cols = [col for col in df.columns if self.pattern.match(col)]

            if not input_cols:
                logger.warning("No input activation columns found in history")
                return {}

            # Get the latest values (last row for each column)
            latest_values = df[input_cols].iloc[-1].to_dict()

            # Build the result structure
            result = {}

            for col, value in latest_values.items():
                if match := self.pattern.match(col):
                    pixel_idx = int(match.group(1))

                    # Convert to integer activation (0 or 1)
                    try:
                        numeric_val = float(value)
                        result[pixel_idx] = 1 if numeric_val == 1.0 else 0
                    except (ValueError, TypeError):
                        # Default to inactive if can't convert
                        result[pixel_idx] = 0

            return result

        except Exception as e:
            logger.error(f"Error parsing input activations from history: {e}")
            return {}
