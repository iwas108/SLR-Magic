def verify_file_content(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        # Check for measureText logic
        if "context.measureText(labelText).width" not in content:
            print("FAIL: measureText logic not found.")
            return False

        # Check for Dynamic Right Padding
        if "const dynamicRightPadding = Math.ceil(maxLabelWidth + 60);" not in content:
            print("FAIL: Dynamic right padding calculation not found.")
            return False

        # Check for Total Width Calculation
        if "const totalWidth = graphBodyWidth + dynamicRightPadding + 20;" not in content:
            print("FAIL: Total width calculation not found.")
            return False

        # Check for Filename Logic
        if "const safeTitle = (chartTitle || 'SankeyDiagram').replace(/[^a-z0-9]/gi, '_');" not in content:
            print("FAIL: Filename sanitization not found.")
            return False

        print("SUCCESS: All checks passed.")
        return True

    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    verify_file_content("VisualizerSankeyUI.html")
