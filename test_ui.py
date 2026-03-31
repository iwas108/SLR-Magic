from playwright.sync_api import sync_playwright

def test_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the index.html file locally
        page.goto("file:///app/ollama-middleman/middleman/templates/index.html")

        # Wait for the page to load
        page.wait_for_load_state("networkidle")

        # Mock a stream start event by injecting JS
        page.evaluate("""
            const data = {
                type: "start",
                title: "A Very Long Paper Title That Explains Everything About Everything In The World And Beyond",
                abstract: "This is a very long abstract. " + "It contains a lot of text. ".repeat(20) + "We want to make sure it displays fully without being clamped to just two lines. If the CSS changes worked, this entire block of text should be visible on the screen when the card is shown."
            };

            const inProgressCard = document.getElementById('in-progress-card');
            const inProgressTitle = document.getElementById('in-progress-title');
            const inProgressAbstract = document.getElementById('in-progress-abstract');

            inProgressTitle.textContent = data.title;
            inProgressAbstract.textContent = data.abstract;
            inProgressAbstract.style.display = 'block';
            inProgressCard.style.display = 'block';
        """)

        # Take a screenshot of the specific card
        card_locator = page.locator("#in-progress-card")
        card_locator.screenshot(path="ui_test_screenshot.png")

        browser.close()

if __name__ == "__main__":
    test_ui()
    print("Screenshot saved to ui_test_screenshot.png")
