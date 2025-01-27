import numpy as np

def hex_grid(rows, cols, hex_size=1.5):
    """Generate center positions for a grid of MACs with adjusted spacing for Three.js."""
    row_indices = np.arange(rows)
    col_indices = np.arange(cols)
    col_grid, row_grid = np.meshgrid(col_indices, row_indices)

    x_positions = col_grid * 2.0 * hex_size  # Adjusted for better spacing
    y_positions = row_grid * (np.sqrt(3) * hex_size)

    # Offset odd columns for hexagonal grid
    y_positions[:, 1::2] += np.sqrt(3) * hex_size / 2

    # Center the grid for Three.js visualization
    x_positions -= (cols - 1) * 1.5 * hex_size / 2
    y_positions -= (rows - 1) * (np.sqrt(3) * hex_size) / 2

    return np.stack([x_positions.ravel(), y_positions.ravel()], axis=1)

def cm_centers(center_x, center_y, size=0.7, num_cms=6):
    """Generate centers for CMs within a MAC, adjusted for Three.js."""
    if num_cms == 1:
        return [(center_x, center_y)]
    angles = np.linspace(0, 2 * np.pi, num_cms, endpoint=False)
    offsets = np.stack([np.cos(angles), np.sin(angles)]) * size
    centers = np.array([center_x, center_y])[:, None] + offsets
    return centers.T

def neuron_centers(center_x, center_y, radius=0.1, num_neurons=6):
    """Generate neuron centers in a radial arrangement with better spacing."""
    if num_neurons == 1:
        return [(center_x, center_y)]
    angles = np.linspace(0, 2 * np.pi, num_neurons, endpoint=False)
    offsets = np.stack([np.cos(angles), np.sin(angles)]) * 2 * radius
    centers = np.array([center_x, center_y])[:, None] + offsets
    return centers.T
