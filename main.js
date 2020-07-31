// The svg
var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

// Map and projection

var center_of_map = [-100, 40];
var projection = d3.geoMercator()
    .center(center_of_map)                // GPS of location to zoom on
    .scale(550)                       // This is like the zoom
    .translate([width / 2, height / 4])

var angle = 0;
var left_top, left_bottom, right_top, right_bottom;
var hit_stat_sig = false;

d3.queue()
    .defer(d3.json, "https://raw.githubusercontent.com/shawnbot/topogram/master/data/us-states.geojson")  // USA shape
    .defer(d3.csv, "initial_points.csv") // Position of circles
    //.defer(d3.json, "https://bl.ocks.org/mbostock/raw/9943478/us.json") 
    //.defer(d3.csv, "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/data_gpsLocSurfer.csv") // Position of circles
    .await(ready);

function ready(error, dataGeo, data) {

    //data = d3.shuffle(data);

    // Create a color scale
    var allContinent = d3.map(data, function (d) { return (d.homecontinent) }).keys()
    var color = d3.scaleOrdinal()
        .domain(allContinent)
        .range(d3.schemePaired);

    // Add a scale for bubble size
    var valueExtent = d3.extent(data, function (d) { return +d.n; })
    var size = d3.scaleSqrt()
        .domain(valueExtent)  // What's in the data
        .range([1, 50])  // Size in pixel

    // Draw the map
    svg.append("g")
        .selectAll("path")
        .data(dataGeo.features)
        .enter()
        .append("path")
        .attr("fill", "none")
        .attr("d", d3.geoPath()
            .projection(projection)
        )
        .style("stroke", "#b8b8b8")
        .style("opacity", .7)

    /* scale and axis for x */
    // Create scale
    var x_scale = d3.scalePoint()
        .domain(['', 'Purple side', 'Green side', ' '])
        .range([100, width - 100]);
    // Add scales to axis
    var x_axis = d3.axisBottom()
        .scale(x_scale);

    //Append group and insert axis
    svg
        .append("g")
        .attr("transform", "translate(0," + 0.9 * height + ")")
        .call(x_axis);

    /* scale and axis for y */
    var y_scale = d3.scaleLinear()
        .domain([65, 70])
        //.range([height/4,0]);
        .range([0.9 * height, 0.9 * height - height / 4])

    // Add scales to axis
    var y_axis = d3.axisLeft()
        .scale(y_scale);

    //Append group and insert axis
    svg
        .append("g")
        //.attr("transform", "translate(100," + (0.9*height - height/4) + ")")
        .attr("transform", "translate(100,0)")
        .call(y_axis);

    // Add y axis label
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", 65)
        .attr("x", -(0.9 * height - height / 4))
        .text("Average height (inches)")

    // Add a scale for bubble size
    var valueExtent = d3.extent(data, function (d) { return +d.n; })
    var size = d3.scaleSqrt()
        .domain(valueExtent)  // What's in the data
        .range([1, 50])  // Size in pixel

    // Add circles:
    var circles = svg
        .selectAll("myCircles")
        .data(data)
        //.data(data.sort(function(a,b) { return +b.n - +a.n }).filter(function(d,i){ return i<1000 }))
        .enter()
        .append("circle")
        .attr("cx", function (d) { return projection([+d.homelon, +d.homelat])[0] })
        .attr("cy", function (d) { return projection([+d.homelon, +d.homelat])[1] })
        .attr("r", function (d) { return 2 * size(+d.n) })
        //.style("fill", function(d){ return color(d.homecontinent) })
        //.style("fill", function(d){ if (+d.homelon < -100) return "purple"; else return "green"; })
        .style("fill", function (d) { if (is_left_of_line(+d.homelon, +d.homelat)) return "purple"; else return "green"; })
        //.style("fill", "black")
        .attr("stroke", function (d) { if (d.n > 2000) { return "black" } else { return "none" } })
        .attr("stroke-width", 1)
        //.attr("fill-opacity", .4)
        .attr("fill-opacity", 0.1)
        .attr("class", function (d) { if (is_left_of_line(+d.homelon, +d.homelat)) return "purple-circle"; else return "green-circle"; })



    // add divider line
    var divider = svg.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', 0)
        .attr('stroke', 'black')
        .attr('stroke-width', '5px')
    //.attr("transform", "translate(" + projection(center_of_map)[0] + ",200) rotate(0)")

    update(divider, projection(center_of_map)[0], 200, 0, circles);

    divider
        .transition()
        .duration(1000)
        .attr('y1', -200)
        .attr('y2', 200)
    //.on("end", play_animation(svg, data, circles, x_scale, y_scale))

    // when the input range changes update the angle 
    d3.select("#nAngle").on("input", function () {
        angle = +this.value;
        update(divider, projection(center_of_map)[0], 200, +this.value, circles);
    });

    circles
        .style("fill", function (d) { if (is_left_of_line(+d.homelon, +d.homelat)) return "purple"; else return "green"; });

    $('#start-button').click(function () {
        $('#instructions').slideUp();
        $('#started').fadeIn();
        play_animation(svg, data, circles, x_scale, y_scale);
    });
}

// update the element
function update(divider, x, y, nAngle, circles) {

    // adjust the text on the range slider
    //d3.select("#nAngle-value").text(nAngle);
    d3.select("#nAngle").property("value", nAngle);

    // rotate the line
    divider
        .attr("transform", "translate(" + x + "," + y + ") rotate(" + nAngle + ")");

    circles
        .style("fill", function (d) {
            if (is_left_of_line(+d.homelon, +d.homelat)) return "purple"; else return "green";
        })
}

function play_animation(svg, data, circles, x_scale, y_scale) {
    // get averages for left and Green sides
    var avg_height_by_split = d3
        .nest()
        .key(function (d) { return is_left_of_line(+d.homelon, +d.homelat); })
        .rollup(function (v) { return d3.mean(v, v => +v.height); })
        .entries(data)
        .map(function (d) { return d.value; })

    // compute the running mean in each group
    // store in the array moving_target,
    // which has the final location that each point should go to
    var running_sum = [0, 0];
    var running_count = [0, 0];
    var moving_target = [];
    var side_of_line = [];
    var diff_means = [];
    for (i = 0; i < data.length; i++) {
        var side = +(is_left_of_line(+data[i].homelon, +data[i].homelat));
        running_sum[side] += +data[i].height;
        running_count[side] += 1;
        moving_target.push(running_sum[side] / running_count[side]);

        diff_means.push(running_sum[0] / running_count[0] - running_sum[1] / running_count[1]);

        if (!side)
            side_of_line.push('Purple side')
        else
            side_of_line.push('Green side')
    }

    // compute the running standard error in each group
    // store in the array moving_se,
    // which has the error bar size for each point
    var running_squared_diff = [0, 0];
    var running_count = [0, 0];
    var moving_se = [];
    var t_stat = [];
    for (i = 0; i < data.length; i++) {
        var side = +(is_left_of_line(+data[i].homelon, +data[i].homelat));
        running_squared_diff[side] += Math.pow(+data[i].height - moving_target[i], 2);
        running_count[side] += 1;
        var sd = Math.sqrt(running_squared_diff[side] / running_count[side]);
        moving_se.push(sd / Math.sqrt(running_count[side]));

        var var_left = (running_squared_diff[0] / running_count[0]) / (running_count[0]);
        var var_right = (running_squared_diff[1] / running_count[1]) / (running_count[1]);

        var sd_pooled = Math.sqrt((running_count[0] * var_left + running_count[1] * var_right) / i);
        t_stat.push(diff_means[i] / sd_pooled);
    }

    // Add a scale for bubble size
    var valueExtent = d3.extent(data, function (d) { return +d.n; })
    var size = d3.scaleSqrt()
        .domain(valueExtent)  // What's in the data
        .range([1, 50])  // Size in pixel

    // animate points
    circles
        .transition()
        .delay(function (d, i) { return 100 * i; })
        .duration(0)
        .attr("fill-opacity", 1)
        .attr("r", function (d) { return 3 * size(+d.n) })
        .transition()
        //.delay(function(d,i){ return 10*i; }) 
        .ease(d3.easeLinear)
        .duration(100)
        .attr("cx", function (d) { if (is_left_of_line(+d.homelon, +d.homelat)) return x_scale('Purple side'); else return x_scale('Green side'); })
        .attr("cy", function (d, i) { return y_scale(moving_target[i]) })
        .transition()
        //.delay(function(d,i){ return 10*i; })
        .duration(10)
        .attr("fill-opacity", function (d, i) { if (i == data.length) return 1; else return 0; })


    var point_ndx = 0;

    var left_average = svg
        .append("circle")
        .attr("r", 3)
        .attr("id", "left-average")
        .style("fill", "purple")
        .attr("stroke-width", 1)
        .attr("fill-opacity", 0)

    var right_average = svg
        .append("circle")
        .attr("id", "right-average")
        .attr("r", 3)
        .style("fill", "green")
        .attr("stroke-width", 1)
        .attr("fill-opacity", 0)

    var left_bar = svg
        .append("line")
        .attr("id", "left-bar")
        .attr('x1', x_scale('Purple side'))
        .attr('x2', x_scale('Purple side'))
        .attr('y1', y_scale(65))
        .attr('y2', y_scale(70))
        .attr("stroke", "purple")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

    var right_bar = svg
        .append("line")
        .attr("id", "right-average")
        .attr('x1', x_scale('Green side'))
        .attr('x2', x_scale('Green side'))
        .attr('y1', y_scale(65))
        .attr('y2', y_scale(70))
        .attr("stroke", "green")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

    function move_average() {
        if (point_ndx >= moving_target.length)
            return;
        else {
            var side = side_of_line[point_ndx];

            var this_average, this_bar;
            if (side == 'Purple side') {
                this_average = left_average;
                this_bar = left_bar;
            } else {
                this_average = right_average;
                this_bar = right_bar;
            }

            left_top = +left_bar.attr('y1')
            left_bottom = +left_bar.attr('y2')
            right_top = +right_bar.attr('y1')
            right_bottom = +right_bar.attr('y2')

            if (!hit_stat_sig && point_ndx > 100 && Math.abs(t_stat[point_ndx]) > 1.96) {
                d3.select('#status').html('<font color=red>We found a statistically significant difference after sampling ' + (point_ndx + 1) + ' people!</font>');
                hit_stat_sig = true;
                d3.selectAll('*').transition();
                return;
            }

            this_average
                .transition()
                .duration(100)
                .attr("cx", x_scale(side))
                .attr("cy", y_scale(moving_target[point_ndx]))
                .on("end", move_average)

            this_bar
                .transition()
                .duration(100)
                .attr("opacity", 1)
                .attr('y1', y_scale(moving_target[point_ndx] + moving_se[point_ndx]))
                .attr('y2', y_scale(moving_target[point_ndx] - moving_se[point_ndx]))

            d3.select('#samples-taken').html(point_ndx + 1);
            point_ndx = point_ndx + 1;
        }
    }


    left_average
        .transition()
        .duration(100)
        .attr("cx", x_scale('Purple side'))
        .attr("cy", y_scale(0))
        .attr("fill-opacity", 1)
        .on("end", move_average);

    right_average
        .transition()
        .duration(100)
        .attr("cx", x_scale('Green side'))
        .attr("cy", y_scale(0))
        .attr("fill-opacity", 1)
        .on("end", move_average);


}

function is_left_of_line(x, y) {
    return (y - 38) - Math.tan((90 - angle) * Math.PI / 180) * (x + 100) > 0;
}