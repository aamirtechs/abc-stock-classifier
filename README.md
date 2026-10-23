# ABC Stock Classifier
Live page: https://aamirtechs.github.io/abc-stock-classifier/

Upload SKU, cost and annual usage and download your inventory classified A, B and C with a Pareto chart. Sellers, operators and developers currently do this by hand, one row or one request at a time, in spreadsheets and paid suites. This tool does the whole batch in the browser for free.

## Features
- CSV input: SKU, unit cost and annual quantity, with optional monthly quantity columns for XYZ variability.
- Adjustable A and B cumulative thresholds, defaulting to 80 and 95 percent of annual value.
- Pareto chart plus a class summary, with dead stock (zero movement) and high value flags.
- Combined ABC-XYZ class per SKU and a classified CSV export sorted by annual value, ready to drive reorder priority.

## How it works
Paste or upload your input, set the options, and run the tool. All processing happens locally in your browser using the shared logic in `src/logic.js`, and you can download the results as files. It runs entirely in the browser.

## Privacy
Runs 100% in your browser. Your files never leave this device, nothing is uploaded,
and there is no tracking.

## Development
Core logic lives in `src/logic.js` and is shared by the page and the tests.
Run the tests with `npm test`.

## License
MIT, Copyright 2026 Amir Hussain.
