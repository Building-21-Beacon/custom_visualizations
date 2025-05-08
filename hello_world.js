looker.plugins.visualizations.add({
  id: "horizontal_performance_growth",
  label: "Horizontal Performance & Growth",
  options: {
    target_value: { type: "number", label: "Target Value", default: 7 }
  },

  create(element, config) {
    // Inject scoped styles
    element.innerHTML = `
      <style>
        .hpvg-tooltip {
          position: absolute;
          padding: 6px 10px;
          font: 14px sans-serif;
          background: rgba(0,0,0,0.7);
          color: #fff;
          border-radius: 4px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease-in-out;
        }
        .hpvg-chart .axis path,
        .hpvg-chart .axis line {
          stroke: #ccc;
        }
        .hpvg-chart .grid line {
          stroke: #eee;
          shape-rendering: crispEdges;
        }
        .hpvg-bar-base {
          fill: #6baed6;
        }
        .hpvg-bar-growth {
          fill: #2171b5;
        }
        .hpvg-target-line {
          stroke: #e6550d;
          stroke-dasharray: 4 4;
          stroke-width: 2;
        }
        .hpvg-label {
          font: 12px sans-serif;
          fill: #333;
        }
      </style>
      <div class="hpvg-tooltip"></div>
    `;

    // Load D3 if necessary
    if (typeof d3 === 'undefined' || !d3.scaleBand) {
      const script = document.createElement('script');
      script.src = 'https://d3js.org/d3.v6.min.js';
      script.onload = () => this._initSvg(element);
      document.head.appendChild(script);
    } else {
      this._initSvg(element);
    }
  },

  _initSvg(element) {
    // Create the SVG container
    this._svg = d3.select(element)
      .append('svg')
      .classed('hpvg-chart', true)
      .style('width', '100%')
      .style('height', '100%');
    this._tooltip = d3.select(element).select('.hpvg-tooltip');

    // Make chart responsive
    window.addEventListener('resize', () => {
      // Debounce resize events
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.updateAsync(this._lastData, this._lastElement, this._lastConfig, this._lastQR, {}, () => {});
      }, 200);
    });
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    this._lastData = data;
    this._lastElement = element;
    this._lastConfig = config;
    this._lastQR = queryResponse;

    this.clearErrors();
    if (!this._svg) this._initSvg(element);
    this._svg.selectAll('*').remove();

    // Validate fields
    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 2) {
      this.addError({ title: 'Missing Fields', message: 'Requires 1 dimension + 2 measures: Competency, Performance, Growth.' });
      return done();
    }

    const dim = queryResponse.fields.dimensions[0].name;
    const perfField = queryResponse.fields.measures[0].name;
    const growthField = queryResponse.fields.measures[1].name;
    const target = +config.target_value || 0;

    // Process data
    let pts = data.map(d => ({
      competency: d[dim].value,
      performance: +d[perfField].value,
      growth: +d[growthField].value
    })).filter(d => d.competency && isFinite(d.performance) && isFinite(d.growth));
    if (!pts.length) {
      this.addError({ title: 'No Data', message: 'No valid rows.' });
      return done();
    }

    // Sort by performance descending
    pts = pts.sort((a, b) => b.performance - a.performance);

    // Dimensions
    const margin = { top: 60, right: 30, bottom: 40, left: 140 };
    const totalW = element.clientWidth;
    const totalH = element.clientHeight;
    const width = totalW - margin.left - margin.right;
    const height = totalH - margin.top - margin.bottom;

    // Create container group
    const svg = this._svg.attr('width', totalW).attr('height', totalH);
    const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const y = d3.scaleBand()
      .domain(pts.map(d => d.competency))
      .range([0, height])
      .padding(0.2);
    const xMax = d3.max(pts, d => Math.max(d.performance, target));
    const x = d3.scaleLinear()
      .domain([0, xMax])
      .range([0, width])
      .nice();

    // Gridlines
    chart.append('g')
      .attr('class', 'grid')
      .call(d3.axisBottom(x)
        .ticks(5)
        .tickSize(height)
        .tickFormat('')
      )
      .attr('transform', `translate(0,${height})`);

    // Axes
    chart.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(y))
      .selectAll('text')
        .attr('font-size', '14px');

    chart.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .selectAll('text')
        .attr('font-size', '14px');

    // Bars: base and growth with transitions
    const bars = chart.selectAll('.hpvg-bar')
      .data(pts)
      .enter()
      .append('g')
      .attr('class', 'hpvg-bar')
      .attr('transform', d => `translate(0,${y(d.competency)})`);

    bars.append('rect')
      .attr('class', 'hpvg-bar-base')
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .transition().duration(800).ease(d3.easeCubic)
      .attr('width', d => x(d.performance - d.growth));

    bars.append('rect')
      .attr('class', 'hpvg-bar-growth')
      .attr('x', d => x(d.performance - d.growth))
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .transition().duration(800).ease(d3.easeCubic)
      .attr('width', d => x(d.growth));

    // Data labels at end of bars
    bars.append('text')
      .attr('class', 'hpvg-label')
      .attr('x', d => x(d.performance) + 6)
      .attr('y', y.bandwidth()/2)
      .attr('dy', '0.35em')
      .text(d => d.performance)
      .attr('opacity', 0)
      .transition().delay(800).duration(400)
      .attr('opacity', 1);

    // Target line
    chart.append('line')
      .attr('class', 'hpvg-target-line')
      .attr('x1', x(target))
      .attr('x2', x(target))
      .attr('y1', 0)
      .attr('y2', height);

    // Legend
    const legendData = [
      { label: 'Base Performance', color: '#6baed6' },
      { label: 'Growth', color: '#2171b5' },
      { label: `Target (${target})`, color: '#e6550d', shape: 'line' }
    ];

    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top - 40})`);

    const item = legend.selectAll('.legend-item')
      .data(legendData)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d,i) => `translate(${i * 180}, 0)`);

    item.each(function(d) {
      const g = d3.select(this);
      if (d.shape === 'line') {
        g.append('line')
          .attr('x1', 0).attr('x2', 20)
          .attr('y1', 6).attr('y2', 6)
          .style('stroke', d.color)
          .style('stroke-width', 2)
          .style('stroke-dasharray', '4 4');
      } else {
        g.append('rect')
          .attr('width', 16)
          .attr('height', 16)
          .style('fill', d.color);
      }
      g.append('text')
        .attr('x', d.shape === 'line' ? 24 : 20)
        .attr('y', 8)
        .attr('dy', '0.35em')
        .attr('font-size', '14px')
        .text(d.label);
    });

    done();
  }
});

