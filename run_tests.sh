#!/bin/bash

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "Running Python tests..."
pytest tests/python -v

echo "Running JavaScript tests..."
npm run test:js

# Print final status
if [ $? -eq 0 ]; then
    echo "All tests completed successfully!"
else
    echo "Some tests failed. Check the output above for details."
fi
