import numpy as np

def hex_grid(rows, cols, hex_size=1):
    """Generate center positions for a grid of MACs."""
    row_indices = np.arange(rows)
    col_indices = np.arange(cols)
    col_grid, row_grid = np.meshgrid(col_indices, row_indices)

    x_positions = col_grid * 1.5 * hex_size
    y_positions = row_grid * (np.sqrt(3) * hex_size)

    # Offset odd columns
    y_positions[:, 1::2] += np.sqrt(3) * hex_size / 2

    # Center the grid
    x_positions -= (cols - 1) * 1.5 * hex_size / 2
    y_positions -= (rows - 1) * (np.sqrt(3) * hex_size) / 2

    return np.stack([x_positions.ravel(), y_positions.ravel()], axis=1)

def mac_boundary(center_x, center_y, size=1):
    """Generate vertices for the boundary of a MAC as a regular hexagon."""
    angles = np.linspace(0, 2 * np.pi, 7)
    offsets = np.stack([np.cos(angles), np.sin(angles)]) * size
    centers = np.array([center_x, center_y])[:, None]
    vertices = centers + offsets
    return vertices[0], vertices[1]

def cm_centers(center_x, center_y, size, num_cms):
    """Generate centers for CMs within a MAC."""
    if num_cms == 1:
        return [(center_x, center_y)]
    angles = np.linspace(0, 2 * np.pi, num_cms, endpoint=False)
    offsets = np.stack([np.cos(angles), np.sin(angles)]) * size
    centers = np.array([center_x, center_y])[:, None] + offsets
    return centers.T

def neuron_centers(center_x, center_y, radius, num_neurons):
    """Generate neuron centers in a radial arrangement."""
    if num_neurons == 1:
        return [(center_x, center_y)]
    angles = np.linspace(0, 2 * np.pi, num_neurons, endpoint=False)
    offsets = np.stack([np.cos(angles), np.sin(angles)]) * 2 * radius
    centers = np.array([center_x, center_y])[:, None] + offsets
    return centers.T
