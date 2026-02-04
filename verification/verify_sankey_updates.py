import re

def verify_file_content(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        # Check for Title Input
        if 'id="chart-title"' not in content:
            print("FAIL: Title input not found.")
            return False

        # Check for Default Title Logic
        if "selectedColumns.map(c => c.name).join(' vs ')" not in content:
            print("FAIL: Default title generation logic not found.")
            return False

        # Check for Dynamic Title usage in Option
        if "text: chartTitle || 'Data Collection Flow'" not in content:
            print("FAIL: Dynamic title usage in getChartOption not found.")
            return False

        # Check for Fixed Width in Download
        if "const fixedWidth = 2500;" not in content:
            print("FAIL: Fixed width 2500 not found in downloadSVG.")
            return False

        # Check for Right Margin in Download
        if "option.series[0].right = 500;" not in content:
            print("FAIL: Right margin 500 not found in downloadSVG.")
            return False

        print("SUCCESS: All checks passed.")
        return True

    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    verify_file_content("VisualizerSankeyUI.html")
