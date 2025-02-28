import numpy as np

def hex_grid(rows, cols, hex_size=1.5):
    """
    Generate center positions for a hexagonal grid of MACs.
    Each MAC is drawn as a hex in main.js with side length ~2.0 (by default).
    """
    row_indices = np.arange(rows)
    col_indices = np.arange(cols)
    col_grid, row_grid = np.meshgrid(col_indices, row_indices)

    x_positions = col_grid * 2.0 * hex_size
    y_positions = row_grid * (np.sqrt(3) * hex_size)

    # Offset odd columns
    y_positions[:, 1::2] += np.sqrt(3) * hex_size / 2

    # Center the grid
    x_positions -= (cols - 1) * 1.5 * hex_size / 2
    y_positions -= (rows - 1) * (np.sqrt(3) * hex_size) / 2

    return np.stack([x_positions.ravel(), y_positions.ravel()], axis=1)


def place_cms_in_mac(mac_center_x, mac_center_y,
                     mac_radius, num_cms,
                     cm_radius=0.5, gap=0.2):
    """
    Place `num_cms` CMs (each with radius cm_radius) in a circle within
    a MAC of radius mac_radius. Ensures:
      1) They don't cross the MAC boundary.
      2) They don't overlap each other (gap in between).

    Returns a list of (x, y) coordinates for the CM centers.
    """
    # If there's only 1 CM, just place it at the center.
    if num_cms <= 1:
        return [(mac_center_x, mac_center_y)]

    # 1) The circle radius must be small enough so each CM stays within the MAC boundary:
    #    circle_radius + cm_radius <= mac_radius
    boundary_limit = mac_radius - cm_radius

    # 2) The circle radius must be large enough so the chord distance between adjacent CMs
    #    is at least (2*cm_radius + gap). The chord for n items is:
    #    chord = 2 * circle_radius * sin(pi / n)
    #    => circle_radius >= (cm_radius + gap/2) / sin(pi/n)
    #    so we solve for circle_radius:
    overlap_limit = (cm_radius + gap/2.0) / np.sin(np.pi / num_cms)

    # We pick the smaller circle_radius that satisfies boundary and no-overlap constraints.
    # Actually, to avoid overlap, circle_radius must be >= overlap_limit,
    # but also must be <= boundary_limit to stay inside the MAC.
    # If we can't satisfy both, we clamp or fallback.
    circle_radius = min(boundary_limit, overlap_limit)

    # If circle_radius <= 0, constraints can't be met (too many CMs, or MAC too small).
    if circle_radius <= 0:
        # Fallback: place them all at center (or raise an exception).
        return [(mac_center_x, mac_center_y)] * num_cms

    # Evenly distribute them around the circle
    angles = np.linspace(0, 2 * np.pi, num_cms, endpoint=False)
    centers = []
    for angle in angles:
        x = mac_center_x + circle_radius * np.cos(angle)
        y = mac_center_y + circle_radius * np.sin(angle)
        centers.append((x, y))

    return centers


def place_neurons_in_cm(cm_center_x, cm_center_y,
                        cm_radius, num_neurons,
                        neuron_radius=0.15, gap=0.1):
    """
    Place `num_neurons` items (each with radius neuron_radius) inside a CM
    of radius cm_radius. Similar logic to place_cms_in_mac:
      1) They don't cross CM boundary.
      2) They don't overlap each other (gap in between).

    Returns a list of (x, y) for neuron centers.
    """
    if num_neurons <= 1:
        return [(cm_center_x, cm_center_y)]

    # 1) circle_radius + neuron_radius <= cm_radius
    boundary_limit = cm_radius - neuron_radius

    # 2) chord >= (2*neuron_radius + gap)
    overlap_limit = (neuron_radius + gap/2.0) / np.sin(np.pi / num_neurons)
    circle_radius = min(boundary_limit, overlap_limit)

    if circle_radius <= 0:
        # Fallback if constraints can't be met
        return [(cm_center_x, cm_center_y)] * num_neurons

    angles = np.linspace(0, 2 * np.pi, num_neurons, endpoint=False)
    centers = []
    for angle in angles:
        x = cm_center_x + circle_radius * np.cos(angle)
        y = cm_center_y + circle_radius * np.sin(angle)
        centers.append((x, y))

    return centers
