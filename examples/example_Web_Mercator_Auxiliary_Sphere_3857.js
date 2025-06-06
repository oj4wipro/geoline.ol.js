import geolineOlJs from "../src/geoline.ol";
//import geolineOlJs from "@stadtmessungsamt-stuttgart/geoline.ol.js";
import "../src/geoline.ol.css";
import MousePosition from 'ol/control/MousePosition.js';
import Zoom from 'ol/control/Zoom.js';

var mymap;
$(function() {
	mymap = new geolineOlJs();
	mymap.initMap(3857, {}, {
		center: [1021708, 6237140],
		zoom: 12
	});

	mymap.addStmaBaseLayer("Grundkarte");
	mymap.addEsriLayer("https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer");

	const mousePosition = new MousePosition({
		coordinateFormat: function(coordinate) {
			return (Math.round(coordinate[0] * 1000) / 1000).toString() + " / " +
				(Math.round(coordinate[1] * 1000) / 1000).toString()
		}
	});
	mymap.getMap().addControl(mousePosition);

	const zoom = new Zoom({});
	mymap.getMap().addControl(zoom);
});
