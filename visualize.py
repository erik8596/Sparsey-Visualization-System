import sys
import signal
from prototype import initialize_svs  # Import the initialization function

# Set to True for debugging mode; False for production
DEBUG = True

def timeout_handler(signum, frame):
    """Handles timeout for user input."""
    print("\nNo confirmation received. Exiting the program.")
    sys.exit(0)

def get_user_confirmation():
    """Prompts user for confirmation and exit after 30 seconds if no response."""
    print("Do you want to launch the Sparsey Visualizer? (yes/no):")
    signal.signal(signal.SIGALRM, timeout_handler)  # Set timeout handler
    signal.alarm(30)  # Set timeout for 30 seconds
    response = input().strip().lower()
    signal.alarm(0)  # Cancel the alarm if input is received
    return response == 'yes'

def main():
    """Main function to handle user interaction and launch the visualizer."""
    if get_user_confirmation():
        print("User confirmed. Initializing Sparsey Visualizer...")
        try:
            if DEBUG:
                # Debug mode: Execute with potential error details printed
                initialize_svs()
                print("Visualizer initialized successfully.")
            else:
                # Production mode: Suppress non-critical output
                initialize_svs()
        except Exception as e:
            print(f"An error occurred during initialization: {e}")
    else:
        print("Visualization initialization canceled.")

if __name__ == "__main__":
    main()
