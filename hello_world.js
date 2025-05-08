looker.plugins.visualizations.add({
  id: "lighthouse_bars",
  label: "Lighthouse Bars",
  options: {},

  create(element, config) {
    // inject basic styles
    element.innerHTML = `
      <style>
        .tooltip {
          position: absolute;
          padding: 4px 8px;
          font: 12px sans-serif;
          background: rgba(0,0,0,0.7);
          color: #fff;
          border-radius: 4px;
          pointer-events: none;
          opacity: 0;
        }
      </style>
      <div class="tooltip"></div>
    `;

    // load D3 (v6+) if not present
    if (typeof d3 === 'undefined' || !d3.scaleBand) {
      const s = document.createElement('script');
      s.src = 'https://d3js.org/d3.v6.min.js';
      s.onload = () => this._initSvg(element);
      document.head.appendChild(s);
    } else {
      this._initSvg(element);
    }
  },

  _initSvg(element) {
    // set up the SVG container and tooltip reference
    this._svg = d3.select(element)
      .append('svg')
      .style('width', '100%')
      .style('height', '100%');
    this._tooltip = d3.select(element).select('.tooltip');
  },

  updateAsync(data, element, config, queryResponse, details, done) {
    // clear previous errors and drawing
    this.clearErrors();
    this._svg.selectAll('*').remove();

    // require 1 dimension + 2 measures
    if (queryResponse.fields.dimensions.length < 1 || queryResponse.fields.measures.length < 2) {
      this.addError({
        title: "Missing Fields",
        message: "Requires 1 dimension + 2 measures: Competency, Performance, Target."
      });
      return done();
    }

    // extract field names
    const dimName    = queryResponse.fields.dimensions[0].name;
    const perfName   = queryResponse.fields.measures[0].name;
    const targetName = queryResponse.fields.measures[1].name;

    // map & filter data
    const pts = data
      .map(d => ({
        competency: d[dimName].value,
        performance: +d[perfName].value,
        target: +d[targetName].value
      }))
      .filter(d => d.competency != null && !isNaN(d.performance) && !isNaN(d.target));

    if (pts.length === 0) {
      this.addError({ title: "No Data", message: "No valid rows." });
      return done();
    }

    // dimensions and margins
    const w = element.clientWidth;
    const h = element.clientHeight;
    const margin = { top: 40, right: 20, bottom: 40, left: 20 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    // create group
    const g = this._svg
      .attr('width', w)
      .attr('height', h)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // scales
    const x = d3.scaleBand()
      .domain(pts.map(d => d.competency))
      .range([0, innerW])
      .padding(0.4);

    const maxVal = d3.max(pts, d => Math.max(d.performance, d.target));
    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.1])
      .range([innerH, 0]);

    // axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x));

    // draw lighthouses
    const towers = g.selectAll('.lighthouse')
      .data(pts)
      .enter()
      .append('g')
      .attr('class', 'lighthouse')
      .attr('transform', d => `translate(${x(d.competency) + x.bandwidth()/2},0)`);

    // tower rectangle
    towers.append('rect')
      .attr('x', -x.bandwidth()/4)
      .attr('width', x.bandwidth()/2)
      .attr('y', d => y(d.performance))
      .attr('height', d => innerH - y(d.performance))
      .style('fill', '#3498db');

    // light at top (circle)
    towers.append('circle')
      .attr('cx', 0)
      .attr('cy', d => y(d.performance))
      .attr('r', x.bandwidth()/3)
      .style('fill', 'yellow')
      .style('opacity', d => d.performance >= d.target ? 1 : 0);

    // target marker
    towers.append('line')
      .attr('x1', -x.bandwidth()/4)
      .attr('x2',  x.bandwidth()/4)
      .attr('y1', d => y(d.target))
      .attr('y2', d => y(d.target))
      .style('stroke', '#e74c3c')
      .style('stroke-dasharray', '2,2');

    // competency labels
    towers.append('text')
      .attr('y', innerH + 15)
      .attr('dy', '.71em')
      .attr('text-anchor', 'middle')
      .text(d => d.competency);

    done();
  }
});

