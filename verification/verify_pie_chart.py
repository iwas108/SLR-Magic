from playwright.sync_api import sync_playwright
import os

def test_pie_chart_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Inject mock object
        page.add_init_script("""
        window.google = {
          script: {
            run: {
              withSuccessHandler: function(success) {
                this.success = success;
                return this;
              },
              withFailureHandler: function(failure) {
                this.failure = failure;
                return this;
              },
              getVisualizerColumns: function() {
                console.log("Mock getVisualizerColumns called");
                setTimeout(() => this.success(["Column A", "Column B", "Column C"]), 100);
              },
              generatePieChartData: function(config) {
                console.log("Mock generatePieChartData called with", config);
                setTimeout(() => this.success({
                  legendData: ["Value 1", "Value 2", "Value 3", "Value 4", "Value 5"],
                  seriesData: [
                    { name: "Value 1", value: 100 },
                    { name: "Value 2", value: 200 },
                    { name: "Value 3", value: 300 },
                    { name: "Value 4", value: 50 },
                    { name: "Value 5", value: 25 }
                  ]
                }), 500);
              }
            }
          }
        };
        """)

        # Load the local HTML file
        cwd = os.getcwd()
        file_path = f"file://{cwd}/VisualizerPieChartUI.html"
        print(f"Loading {file_path}")
        page.goto(file_path)

        # Step 1: Select Column
        print("Waiting for column list...")
        page.wait_for_selector("input[value='Column A']")
        print("Selecting Column A...")
        page.click("input[value='Column A']")

        # Click Next
        print("Clicking Next...")
        page.click("button.btn-primary:has-text('Next: Configure')")

        # Step 2: Configure
        print("Waiting for Step 2...")
        page.wait_for_selector("#step-2:not(.hidden)")

        # NEW: Check the "Enable Detailed Labels" checkbox
        print("Enabling Detailed Labels...")
        page.check("#enable-label")

        # Click Generate
        print("Clicking Generate...")
        page.click("button.btn-primary:has-text('Generate Chart')")

        # Step 3: Visualization
        print("Waiting for Step 3...")
        page.wait_for_selector("#step-3:not(.hidden)")

        # Wait for chart canvas
        print("Waiting for chart to render...")
        page.wait_for_selector("#chart-container canvas")

        # Wait a bit for animation
        page.wait_for_timeout(1000)

        # Take screenshot
        output_path = f"{cwd}/verification/pie_chart_labels_verification.png"
        page.screenshot(path=output_path)
        print(f"Screenshot saved to {output_path}")

        browser.close()

if __name__ == "__main__":
    test_pie_chart_ui()
