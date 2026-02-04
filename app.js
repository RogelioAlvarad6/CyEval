// Grade Trends Visualizer Application

class GradeVisualizer {
  constructor() {
    this.data = [];
    this.requirements = { satisfied: [], inProgress: [], notSatisfied: [] };
    this.charts = {};
    this.colors = [
      '#4f46e5',
      '#06b6d4',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
      '#84cc16',
      '#f97316',
      '#6366f1',
      '#22d3d8',
    ];

    // Letter grade to numeric conversion
    this.letterGrades = {
      'A+': 97,
      A: 94,
      'A-': 90,
      'B+': 87,
      B: 84,
      'B-': 80,
      'C+': 77,
      C: 74,
      'C-': 70,
      'D+': 67,
      D: 64,
      'D-': 60,
      F: 50,
      S: null, // Satisfactory - exclude from GPA
      T2A: 94,
      T2B: 84,
      T4T: null, // Transfer credits
    };

    // Semester ordering for sorting
    this.semesterOrder = {
      Spring: 1,
      Summer: 2,
      Fall: 3,
    };

    this.init();
  }

  init() {
    this.setupFileUpload();
    this.setupControls();
  }

  setupFileUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('csvInput');
    const browseBtn = document.getElementById('browseBtn');

    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) {
        this.processFile(file);
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.processFile(file);
      }
    });
  }

  setupControls() {
    document
      .getElementById('courseFilter')
      .addEventListener('change', () => this.updateCharts());
    document
      .getElementById('chartType')
      .addEventListener('change', () => this.updateCharts());
    document
      .getElementById('showAverage')
      .addEventListener('change', () => this.updateCharts());
  }

  processFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        this.parseData(content, 'csv');
        this.finishProcessing(file.name);
      };
      reader.readAsText(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
        this.parseData(csvContent, 'excel');
        this.finishProcessing(file.name);
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
    }
  }

  finishProcessing(filename) {
    this.showFileInfo(filename, this.data.length);
    this.populateCourseFilter();
    this.showControls();
    this.updateCharts();
    this.renderDegreeProgress();
  }

  parseData(content, type) {
    const lines = content.trim().split('\n');

    // Find the header row - Workday CSVs have a partial header on row 1 and actual headers on row 2
    let headerRowIndex = 0;
    let headers = this.parseCSVLine(lines[0]).map((h) =>
      h.toLowerCase().trim(),
    );

    // Check if this looks like Workday format by checking first few rows
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const rowHeaders = this.parseCSVLine(lines[i]).map((h) =>
        h.toLowerCase().trim(),
      );
      if (
        rowHeaders.some(
          (h) =>
            h === 'requirement' || h === 'academic period' || h === 'grade',
        )
      ) {
        headers = rowHeaders;
        headerRowIndex = i;
        break;
      }
    }

    // Detect if this is Workday format
    const isWorkday = headers.some(
      (h) =>
        h === 'requirement' ||
        h.includes('registrations used') ||
        h === 'academic period',
    );

    console.log('Detected format:', isWorkday ? 'Workday' : 'Simple');
    console.log('Header row index:', headerRowIndex);
    console.log('Headers:', headers);

    if (isWorkday) {
      this.parseWorkdayFormat(lines, headers, headerRowIndex);
    } else {
      this.parseSimpleFormat(lines, headers, headerRowIndex);
    }
  }

  parseWorkdayFormat(lines, headers, headerRowIndex = 0) {
    // Workday format columns (based on the actual export):
    // Requirement, Status, Remaining, Satisfied With Registrations Used, Academic Period, Credits, Grade
    const requirementIdx = headers.findIndex((h) => h === 'requirement');
    const statusIdx = headers.findIndex((h) => h === 'status');
    const remainingIdx = headers.findIndex((h) => h === 'remaining');
    const courseIdx = headers.findIndex(
      (h) => h.includes('satisfied with') || h.includes('registrations used'),
    );
    const periodIdx = headers.findIndex(
      (h) => h.includes('academic period') || h === 'academic period',
    );
    const creditsIdx = headers.findIndex(
      (h) => h.includes('credits') || h === 'credits',
    );
    const gradeIdx = headers.findIndex((h) => h === 'grade');

    console.log(
      'Column indices - Course:',
      courseIdx,
      'Period:',
      periodIdx,
      'Credits:',
      creditsIdx,
      'Grade:',
      gradeIdx,
    );

    this.data = [];
    this.requirements = { satisfied: [], inProgress: [], notSatisfied: [] };
    const seenEntries = new Set(); // Track unique course+period combinations
    const seenRequirements = new Set(); // Track unique requirements

    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length < 2) continue;

      const requirement = values[requirementIdx]?.trim() || '';
      const status = values[statusIdx]?.trim() || '';
      const remaining = values[remainingIdx]?.trim() || '';
      const courseRaw = values[courseIdx]?.trim() || '';
      const periodRaw = values[periodIdx]?.trim() || '';
      const gradeRaw = values[gradeIdx]?.trim() || '';
      const credits = parseInt(values[creditsIdx]) || 0;

      // Track unique requirements for degree progress
      if (requirement && !seenRequirements.has(requirement)) {
        seenRequirements.add(requirement);

        // Skip GPA requirements (they're status indicators, not actual course requirements)
        if (
          !requirement.startsWith('GPA:') &&
          !requirement.includes('GPA of')
        ) {
          if (status === 'Not Satisfied') {
            this.requirements.notSatisfied.push({
              requirement,
              remaining,
              credits: this.parseCreditsFromRemaining(remaining),
            });
          } else if (status === 'In Progress') {
            this.requirements.inProgress.push({ requirement, courseRaw });
          } else if (status === 'Satisfied') {
            this.requirements.satisfied.push({ requirement });
          }
        }
      }

      // Skip empty rows, in-progress courses, or courses without grades for grade data
      if (!courseRaw || !gradeRaw || courseRaw.includes('(In Progress)'))
        continue;

      // Parse course name (format: "COM S 227 - Object-oriented Programming")
      const courseParts = courseRaw.split(' - ');
      const courseCode = courseParts[0]?.trim() || courseRaw;
      const courseName = courseParts[1]?.trim() || '';

      // Parse academic period (format: "2024 Fall Semester (08/26/2024-12/20/2024)")
      const period = this.parseAcademicPeriod(periodRaw);

      // Parse grade
      const grade = this.parseGrade(gradeRaw);
      if (grade === null) continue; // Skip S grades and other non-numeric

      // Create unique key to avoid duplicates
      const uniqueKey = `${courseCode}-${period.sortKey}`;
      if (seenEntries.has(uniqueKey)) continue;
      seenEntries.add(uniqueKey);

      this.data.push({
        date: period.display,
        sortKey: period.sortKey,
        course: courseCode,
        courseName: courseName,
        grade: grade,
        gradeRaw: gradeRaw,
        credits: credits,
      });
    }

    // Sort by semester
    this.data.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    console.log('Requirements parsed:', this.requirements);
  }

  parseCreditsFromRemaining(remaining) {
    // Parse "Minimum 3 Credit(s)" or "Minimum 9 Credit(s)" format
    const match = remaining.match(/Minimum\s+(\d+)\s+Credit/i);
    return match ? parseInt(match[1]) : 0;
  }

  parseSimpleFormat(lines, headers, headerRowIndex = 0) {
    // Simple format: Date, Course, Grade, Assignment (optional)
    const dateIdx = this.findColumnIndex(headers, [
      'date',
      'period',
      'semester',
      'term',
      'week',
      'time',
    ]);
    const courseIdx = this.findColumnIndex(headers, [
      'course',
      'class',
      'subject',
      'course name',
      'course_name',
    ]);
    const gradeIdx = this.findColumnIndex(headers, [
      'grade',
      'score',
      'mark',
      'points',
      'percentage',
    ]);
    const assignmentIdx = this.findColumnIndex(headers, [
      'assignment',
      'task',
      'test',
      'exam',
      'type',
    ]);

    this.data = [];

    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length < 3) continue;

      const grade = this.parseGrade(values[gradeIdx]);
      if (grade === null) continue;

      const dateStr = values[dateIdx]?.trim() || `Entry ${i}`;
      const period = this.parseAcademicPeriod(dateStr);

      this.data.push({
        date: period.display || dateStr,
        sortKey: period.sortKey || dateStr,
        course: values[courseIdx]?.trim() || 'Unknown',
        courseName: '',
        grade: grade,
        gradeRaw: values[gradeIdx]?.trim(),
        assignment: values[assignmentIdx]?.trim() || '',
      });
    }

    // Sort by date
    this.data.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  parseAcademicPeriod(periodStr) {
    if (!periodStr) return { display: 'Unknown', sortKey: '0000-0' };

    // Match patterns like "2024 Fall Semester" or "Fall 2024"
    const match1 = periodStr.match(/(\d{4})\s*(Spring|Summer|Fall)/i);
    const match2 = periodStr.match(/(Spring|Summer|Fall)\s*(\d{4})/i);

    let year, semester;
    if (match1) {
      year = match1[1];
      semester =
        match1[2].charAt(0).toUpperCase() + match1[2].slice(1).toLowerCase();
    } else if (match2) {
      semester =
        match2[1].charAt(0).toUpperCase() + match2[1].slice(1).toLowerCase();
      year = match2[2];
    } else {
      // Try to extract just a year
      const yearMatch = periodStr.match(/\d{4}/);
      if (yearMatch) {
        return { display: yearMatch[0], sortKey: yearMatch[0] + '-0' };
      }
      return { display: periodStr, sortKey: periodStr };
    }

    const semesterNum = this.semesterOrder[semester] || 0;
    return {
      display: `${semester} ${year}`,
      sortKey: `${year}-${semesterNum}`,
    };
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  findColumnIndex(headers, possibleNames) {
    for (const name of possibleNames) {
      const idx = headers.findIndex((h) => h.includes(name));
      if (idx !== -1) return idx;
    }
    // Fallback to index based on common positions
    if (possibleNames.includes('date')) return 0;
    if (possibleNames.includes('course')) return 1;
    if (possibleNames.includes('grade')) return 2;
    if (possibleNames.includes('assignment')) return 3;
    return -1;
  }

  parseGrade(value) {
    if (!value) return null;
    value = value.trim().toUpperCase();

    // Check for letter grades
    if (this.letterGrades[value] !== undefined) {
      return this.letterGrades[value];
    }

    // Parse numeric grade
    const numeric = parseFloat(value.replace('%', ''));
    if (!isNaN(numeric) && numeric >= 0 && numeric <= 100) {
      return numeric;
    }

    return null;
  }

  showFileInfo(filename, rowCount) {
    const fileInfo = document.getElementById('fileInfo');
    fileInfo.innerHTML = `<strong>✓ Loaded:</strong> ${filename} (${rowCount} graded courses)`;
    fileInfo.classList.add('visible');
  }

  showControls() {
    document.getElementById('controls').hidden = false;
    document.getElementById('chartsSection').hidden = false;
  }

  populateCourseFilter() {
    const courseFilter = document.getElementById('courseFilter');
    const courses = [...new Set(this.data.map((d) => d.course))].sort();

    courseFilter.innerHTML = '<option value="all">All Courses</option>';
    courses.forEach((course) => {
      const option = document.createElement('option');
      option.value = course;
      option.textContent = course;
      courseFilter.appendChild(option);
    });
  }

  getFilteredData() {
    const courseFilter = document.getElementById('courseFilter').value;
    if (courseFilter === 'all') {
      return this.data;
    }
    return this.data.filter((d) => d.course === courseFilter);
  }

  updateCharts() {
    const filteredData = this.getFilteredData();
    const chartType = document.getElementById('chartType').value;
    const showAverage = document.getElementById('showAverage').checked;

    this.renderTrendChart(filteredData, chartType, showAverage);
    this.renderComparisonChart(filteredData, chartType);
    this.renderStatistics(filteredData);
  }

  renderTrendChart(data, chartType, showAverage) {
    const ctx = document.getElementById('trendChart').getContext('2d');

    if (this.charts.trend) {
      this.charts.trend.destroy();
    }

    // Get unique sorted dates
    const dateMap = new Map();
    data.forEach((d) => dateMap.set(d.sortKey, d.date));
    const sortedKeys = [...dateMap.keys()].sort();
    const dates = sortedKeys.map((k) => dateMap.get(k));

    const courses = [...new Set(data.map((d) => d.course))];

    const datasets = courses.map((course, index) => {
      const courseData = data.filter((d) => d.course === course);

      const values = sortedKeys.map((sortKey) => {
        const entry = courseData.find((d) => d.sortKey === sortKey);
        return entry ? entry.grade : null;
      });

      return {
        label: course,
        data: values,
        borderColor: this.colors[index % this.colors.length],
        backgroundColor: this.colors[index % this.colors.length] + '33',
        fill: chartType === 'line',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 6,
        pointHoverRadius: 8,
      };
    });

    if (showAverage && data.length > 0) {
      const avgByDate = {};
      data.forEach((d) => {
        if (!avgByDate[d.sortKey]) {
          avgByDate[d.sortKey] = [];
        }
        avgByDate[d.sortKey].push(d.grade);
      });

      const avgValues = sortedKeys.map((sortKey) => {
        const grades = avgByDate[sortKey];
        if (!grades || grades.length === 0) return null;
        return grades.reduce((a, b) => a + b, 0) / grades.length;
      });

      datasets.push({
        label: 'Semester Average',
        data: avgValues,
        borderColor: '#94a3b8',
        borderDash: [5, 5],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 4,
      });
    }

    this.charts.trend = new Chart(ctx, {
      type: chartType === 'radar' ? 'line' : chartType,
      data: {
        labels: dates,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const grade = context.parsed.y;
                if (grade === null) return `${context.dataset.label}: N/A`;
                const letterGrade = this.numericToLetter(grade);
                return `${context.dataset.label}: ${grade.toFixed(1)}% (${letterGrade})`;
              },
            },
          },
        },
        scales: {
          y: {
            min: 50,
            max: 100,
            title: {
              display: true,
              text: 'Grade (%)',
            },
            ticks: {
              callback: (value) => value + '%',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Semester',
            },
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    });
  }

  renderComparisonChart(data, chartType) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    const chartContainer =
      document.getElementById('comparisonChart').parentElement;

    if (this.charts.comparison) {
      this.charts.comparison.destroy();
    }

    // Get unique courses and calculate average for each (handles multiple entries)
    const courses = [...new Set(data.map((d) => d.course))];
    const courseStats = courses
      .map((course) => {
        const courseData = data.filter((d) => d.course === course);
        const grades = courseData.map((d) => d.grade);
        const average = grades.reduce((a, b) => a + b, 0) / grades.length;
        return {
          course,
          grade: average, // Use average if multiple entries exist
          gradeRaw: courseData[0]?.gradeRaw || '',
          count: grades.length,
        };
      })
      .sort((a, b) => b.grade - a.grade); // Sort by grade descending (highest first)

    // Generate colors based on grade (green for high, red for low)
    const backgroundColors = courseStats.map((s) => {
      if (s.grade >= 90) return '#10b981'; // Green - A
      if (s.grade >= 80) return '#22d3d8'; // Cyan - B
      if (s.grade >= 70) return '#f59e0b'; // Yellow - C
      if (s.grade >= 60) return '#f97316'; // Orange - D
      return '#ef4444'; // Red - F
    });

    // Calculate dynamic height based on number of courses (25px per course, min 200px, max 600px)
    const dynamicHeight = Math.min(600, Math.max(200, courseStats.length * 25));
    chartContainer.style.height = `${dynamicHeight + 60}px`; // +60 for padding and title

    this.charts.comparison = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: courseStats.map((s) => s.course),
        datasets: [
          {
            label: 'Grade',
            data: courseStats.map((s) => s.grade),
            backgroundColor: backgroundColors,
            borderColor: backgroundColors,
            borderWidth: 1,
            barThickness: 18,
            maxBarThickness: 22,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Horizontal bars for better label readability
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.x;
                const stat = courseStats[context.dataIndex];
                const letterGrade =
                  stat.gradeRaw || this.numericToLetter(value);
                let label = `${value?.toFixed(1)}% (${letterGrade})`;
                if (stat.count > 1) {
                  label += ` - avg of ${stat.count} entries`;
                }
                return label;
              },
            },
          },
        },
        scales: {
          x: {
            min: 50,
            max: 100,
            title: {
              display: true,
              text: 'Grade (%)',
            },
            ticks: {
              callback: (value) => value + '%',
            },
          },
          y: {
            ticks: {
              font: { size: 12 },
              autoSkip: false, // Show all labels, don't skip any
            },
          },
        },
      },
    });
  }

  numericToLetter(numeric) {
    if (numeric >= 93) return 'A';
    if (numeric >= 90) return 'A-';
    if (numeric >= 87) return 'B+';
    if (numeric >= 83) return 'B';
    if (numeric >= 80) return 'B-';
    if (numeric >= 77) return 'C+';
    if (numeric >= 73) return 'C';
    if (numeric >= 70) return 'C-';
    if (numeric >= 67) return 'D+';
    if (numeric >= 63) return 'D';
    if (numeric >= 60) return 'D-';
    return 'F';
  }

  getGPADescription(gpa) {
    if (gpa >= 3.9) return "Dean's List";
    if (gpa >= 3.5) return 'Magna Cum Laude range';
    if (gpa >= 3.0) return 'Good Standing';
    if (gpa >= 2.5) return 'Satisfactory';
    if (gpa >= 2.0) return 'Minimum Standing';
    return 'Academic Probation';
  }

  renderStatistics(data) {
    const statsGrid = document.getElementById('statsGrid');

    if (data.length === 0) {
      statsGrid.innerHTML = '<p>No data to display</p>';
      return;
    }

    // Filter out transfer credits and pass/fail for accurate statistics
    // (same logic as GPA calculation for consistency)
    const isuGradedData = data.filter((d) => {
      const grade = (d.gradeRaw || '').toUpperCase().trim();
      // Exclude transfer credits (T2A, T2B, T4T, etc.)
      if (grade.startsWith('T')) return false;
      // Exclude pass/fail (S grades)
      if (grade === 'S') return false;
      // Exclude 0-credit courses
      if ((d.credits || 0) === 0) return false;
      return true;
    });

    // Use filtered data for accurate stats, fall back to all data if empty
    const statsData = isuGradedData.length > 0 ? isuGradedData : data;

    const grades = statsData.map((d) => d.grade);
    const average = grades.reduce((a, b) => a + b, 0) / grades.length;
    const highest = Math.max(...grades);
    const lowest = Math.min(...grades);

    // Find highest and lowest course entries
    const highestEntry = statsData.find((d) => d.grade === highest);
    const lowestEntry = statsData.find((d) => d.grade === lowest);

    // Calculate GPA (4.0 scale)
    const gpa = this.calculateGPA(data);

    // Calculate trend using only ISU graded courses with valid dates
    let trend = 0;
    let trendLabel = 'Overall Trend';
    const trendData = statsData.filter(
      (d) => d.sortKey && !d.sortKey.startsWith('0000'),
    );

    if (trendData.length >= 4) {
      const sortedData = [...trendData].sort((a, b) =>
        a.sortKey.localeCompare(b.sortKey),
      );
      const midpoint = Math.floor(sortedData.length / 2);
      const firstHalf = sortedData.slice(0, midpoint);
      const secondHalf = sortedData.slice(midpoint);
      const firstAvg =
        firstHalf.reduce((a, b) => a + b.grade, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((a, b) => a + b.grade, 0) / secondHalf.length;
      trend = secondAvg - firstAvg;
    }

    const stats = [
      {
        label: 'ISU Average',
        value: average.toFixed(1) + '%',
        sublabel: `${this.numericToLetter(average)} (excludes transfers)`,
        class: '',
      },
      {
        label: 'Calculated GPA',
        value: gpa.toFixed(3),
        sublabel: this.getGPADescription(gpa),
        class: gpa >= 3.0 ? 'positive' : gpa >= 2.0 ? 'neutral' : 'negative',
      },
      {
        label: 'Highest Grade',
        value: highest.toFixed(1) + '%',
        sublabel: highestEntry?.course + ` (${highestEntry?.gradeRaw})`,
        class: 'positive',
      },
      {
        label: 'Lowest Grade',
        value: lowest.toFixed(1) + '%',
        sublabel: lowestEntry?.course + ` (${lowestEntry?.gradeRaw})`,
        class: 'negative',
      },
      {
        label: trendLabel,
        value: (trend >= 0 ? '+' : '') + trend.toFixed(1) + '%',
        sublabel: trend > 0 ? 'Improving' : trend < 0 ? 'Declining' : 'Stable',
        class: trend > 0 ? 'positive' : trend < 0 ? 'negative' : 'neutral',
      },
    ];

    statsGrid.innerHTML = stats
      .map(
        (stat) => `
            <div class="stat-card ${stat.class}">
                <div class="stat-value">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
                ${stat.sublabel ? `<div class="stat-course">${stat.sublabel}</div>` : ''}
            </div>
        `,
      )
      .join('');
  }

  calculateGPA(data) {
    // Standard 4.0 GPA scale
    const gpaScale = {
      'A+': 4.0,
      A: 4.0,
      'A-': 3.67,
      'B+': 3.33,
      B: 3.0,
      'B-': 2.67,
      'C+': 2.33,
      C: 2.0,
      'C-': 1.67,
      'D+': 1.33,
      D: 1.0,
      'D-': 0.67,
      F: 0.0,
    };

    let totalPoints = 0;
    let totalCredits = 0;
    let includedCourses = 0;

    data.forEach((d) => {
      // Use the original letter grade from the CSV (gradeRaw) for accuracy
      const originalGrade = (d.gradeRaw || '').toUpperCase().trim();

      // Skip transfer credits (T2A, T2B, T4T, etc.) - they don't affect GPA
      if (originalGrade.startsWith('T')) return;

      // Skip S (Satisfactory) grades - pass/fail don't affect GPA
      if (originalGrade === 'S') return;

      // Skip courses with 0 credits (like orientation)
      const credits = d.credits || 0;
      if (credits === 0) return;

      // Get GPA points from original letter grade
      let points = gpaScale[originalGrade];

      // If not found directly, try without +/-
      if (points === undefined) {
        points = gpaScale[originalGrade.charAt(0)];
      }

      // If still not found, skip this entry
      if (points === undefined) return;

      totalPoints += points * credits;
      totalCredits += credits;
      includedCourses++;
    });

    console.log(
      `GPA calculated from ${includedCourses} courses, ${totalCredits} credits`,
    );
    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  }

  renderDegreeProgress() {
    const progressSection = document.getElementById('degreeProgressSection');
    const progressContent = document.getElementById('degreeProgressContent');

    if (!progressSection || !progressContent) return;

    const { satisfied, inProgress, notSatisfied } = this.requirements;
    const total = satisfied.length + inProgress.length + notSatisfied.length;

    if (total === 0) {
      progressSection.hidden = true;
      return;
    }

    progressSection.hidden = false;

    const completedPercent = Math.round((satisfied.length / total) * 100);
    const inProgressPercent = Math.round((inProgress.length / total) * 100);

    // Calculate total remaining credits needed
    const remainingCredits = notSatisfied.reduce(
      (sum, req) => sum + req.credits,
      0,
    );

    let html = `
            <div class="progress-overview">
                <div class="progress-bar-container">
                    <div class="progress-bar">
                        <div class="progress-filled satisfied" style="width: ${completedPercent}%"></div>
                        <div class="progress-filled in-progress" style="width: ${inProgressPercent}%"></div>
                    </div>
                    <div class="progress-labels">
                        <span class="progress-percent">${completedPercent}% Complete</span>
                    </div>
                </div>
                <div class="progress-stats">
                    <div class="progress-stat">
                        <span class="stat-number satisfied">${satisfied.length}</span>
                        <span class="stat-label">Satisfied</span>
                    </div>
                    <div class="progress-stat">
                        <span class="stat-number in-progress">${inProgress.length}</span>
                        <span class="stat-label">In Progress</span>
                    </div>
                    <div class="progress-stat">
                        <span class="stat-number not-satisfied">${notSatisfied.length}</span>
                        <span class="stat-label">Remaining</span>
                    </div>
                </div>
            </div>
        `;

    if (notSatisfied.length > 0) {
      html += `
                <div class="requirements-section">
                    <h3>Requirements Not Yet Met</h3>
                    <p class="remaining-credits">${remainingCredits} credits still needed</p>
                    <ul class="requirements-list not-satisfied-list">
                        ${notSatisfied
                          .map(
                            (req) => `
                            <li>
                                <span class="req-name">${this.formatRequirementName(req.requirement)}</span>
                                ${req.remaining ? `<span class="req-remaining">${req.remaining}</span>` : ''}
                            </li>
                        `,
                          )
                          .join('')}
                    </ul>
                </div>
            `;
    }

    if (inProgress.length > 0) {
      html += `
                <div class="requirements-section">
                    <h3>Currently In Progress</h3>
                    <ul class="requirements-list in-progress-list">
                        ${inProgress
                          .map(
                            (req) => `
                            <li>
                                <span class="req-name">${this.formatRequirementName(req.requirement)}</span>
                            </li>
                        `,
                          )
                          .join('')}
                    </ul>
                </div>
            `;
    }

    progressContent.innerHTML = html;
  }

  formatRequirementName(name) {
    // Clean up requirement names for display
    return name
      .replace(/\(SE\)|\(COE\)|\(Basic Program\)/g, '')
      .replace(/\[C-? min\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  new GradeVisualizer();
});
