# Course Grade Trends Visualizer

A web-based tool to visualize academic performance over time. Upload your Workday academic progress report or a simple grade CSV/Excel file to see interactive charts, statistics, and degree progress tracking.

## Features

- **Workday Integration** - Automatically parses Workday academic progress report exports
- **Excel & CSV Support** - Import `.csv`, `.xlsx`, or `.xls` files
- **Interactive Charts**
  - Grade trends over time by semester
  - Courses ranked by grade (color-coded by letter grade)
- **Accurate GPA Calculation**
  - Uses original letter grades from your transcript
  - Excludes transfer credits, pass/fail, and 0-credit courses
  - Weighted by credit hours
- **Statistics Summary**
  - ISU Average (excludes transfers)
  - Calculated GPA with standing description
  - Highest and lowest grades
  - Overall trend (improving/declining/stable)
- **Degree Progress Tracking**
  - Visual progress bar
  - Requirements satisfied, in progress, and remaining
  - Credits still needed to graduate

## Getting Started

### Option 1: Open Directly

Simply open `index.html` in any modern web browser.

### Option 2: Web Access COMING SOON

A hosted version will be available online so you can access the tool from anywhere without downloading.

## Usage

1. **Export your data** from Workday:
   - Go to your Academic Progress Report
   - Export as CSV or Excel

2. **Upload the file**:
   - Drag and drop onto the upload area, or
   - Click "Browse Files" to select

3. **Explore your data**:
   - View grade trends over semesters
   - See courses ranked from highest to lowest grade
   - Check your calculated GPA and statistics
   - Track degree completion progress

## Supported File Formats

### Workday Academic Progress Report (Recommended)

The app automatically detects and parses Workday exports with columns:

- Requirement
- Status (Satisfied, In Progress, Not Satisfied)
- Remaining
- Satisfied With Registrations Used (course info)
- Academic Period
- Credits
- Grade

### Simple CSV Format

```csv
Date,Course,Grade,Assignment
Fall 2023,MATH 165,C+,Final
Spring 2024,COM S 227,B,Midterm
```

## GPA Calculation

The GPA is calculated using the standard 4.0 scale:

| Grade | Points |
| ----- | ------ |
| A+/A  | 4.00   |
| A-    | 3.67   |
| B+    | 3.33   |
| B     | 3.00   |
| B-    | 2.67   |
| C+    | 2.33   |
| C     | 2.00   |
| C-    | 1.67   |
| D+    | 1.33   |
| D     | 1.00   |
| D-    | 0.67   |
| F     | 0.00   |

**Excluded from GPA:**

- Transfer credits (T2A, T2B, T4T, etc.)
- Pass/Fail grades (S)
- 0-credit courses (orientation, etc.)

## Tech Stack

- **HTML5** - Structure
- **CSS3** - Styling with CSS variables for theming
- **Vanilla JavaScript** - No framework dependencies
- **Chart.js** - Interactive charts
- **SheetJS (xlsx)** - Excel file parsing

## Project Structure

```
Course-Grade-Trends-Visualizer/
├── index.html          # Main HTML page
├── styles.css          # Stylesheet
├── app.js              # Application logic
└── README.md           # This file
```

## Browser Support

Works in all modern browsers:

- Chrome
- Firefox
- Safari
- Edge

## Privacy

All data processing happens locally in your browser. No data is sent to any server.

## License

MIT License - feel free to use and modify for your own purposes.

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

---

Made for tracking academic progress at Iowa State University, I have not testing with other Institutions
