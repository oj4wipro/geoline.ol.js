/**
 @module stma_openlayers
*/

import jquery from "jquery";
window.$ = window.jQuery = jquery;

import Feature from "ol/Feature";
import Map from "ol/Map";
import Overlay from "ol/Overlay";
import TileGrid from "ol/tilegrid/TileGrid";
import View from "ol/View";
import controlAttribution from "ol/control/Attribution";
import formatEsriJSON from "ol/format/EsriJSON";
import formatGeoJSON from "ol/format/GeoJSON";
import formatWMTSCapabilities from "ol/format/WMTSCapabilities";
import geomPoint from "ol/geom/Point";
import layerImage from "ol/layer/Image";
import layerTile from "ol/layer/Tile";
import layerVector from "ol/layer/Vector";
import sourceImageArcGISRest from "ol/source/ImageArcGISRest";
import sourceImageWMS from "ol/source/ImageWMS";
import sourceTileWMS from 'ol/source/TileWMS';
import sourceVector from "ol/source/Vector";
import sourceXYZ from "ol/source/XYZ";
import sourceWMTS, {optionsFromCapabilities as sourceWMTS_optionsFromCapabilities} from 'ol/source/WMTS';
import styleIcon from "ol/style/Icon";
import styleStyle from "ol/style/Style";
import {defaults as defaultControls} from 'ol/control';

import proj4 from "proj4";
import {get as getProjection} from "ol/proj";
import {register} from 'ol/proj/proj4';

/**
 *	version			@version@
*/

/**
 *	@method			stma_openlayers
 *	@description	Momentan ist OpenLayers 6.3.1 eingebunden.
 *
 *	@returns		{null} -
 *
 *	@since			v0.0
 */
var stma_openlayers = /** @class */ (function () {

	function stma_openlayers(options) {
		var _this = this;
		return _this;
	}

	// ----------------------------------------------------------------------------------
	// Intern
	// ----------------------------------------------------------------------------------
	var projection = null;
	var map = null;
	var viewParams = null;

	var config = null;

	var tileLoadFunction = null;

	var overlayLayer = null;
	var overlayLayers = []; //Layer, für die das Overlay aktiviert ist.
	var overlayFunctions = []; //Funktionen der Layer, für die das Overlay aktiviert ist.

	//	@description	holt die Konfiguration in Abhängigkeit des EPSG-Codes von unserem Internetserver ab.
	//
	//	@since			v0.0
	var _getConfig = function() {
		var _self = this;
		if (config == null) {
			$.ajax({
				method: "POST",
				url: "https://gis5.stuttgart.de/geoline/geoline.config/config.aspx",
				data: {
					v: "@version@",
					epsg: projection,
					url: location.href
				},
				dataType: "json",
				async: false,
				cache: false,
				success: function (_data) {

					_data.ags_hosts = Array.isArray(_data.ags_services)
						? _data.ags_services.map(item => item.ags_host)
						: Object.values(_data.ags_services || {}).map(item => item.ags_host);

					_data.wmts_hosts = Array.isArray(_data.wmts_services)
						? _data.wmts_services.map(item => item.host)
						: Object.values(_data.wmts_services || {}).map(item => item.host);

					_data.wms_hosts = Array.isArray(_data.wms_services)
						? _data.wms_services.map(item => item.host)
						: Object.values(_data.wms_services || {}).map(item => item.host);

					config = _data;
				},
				error: function (xhr, status) {
					console.error("OHOH", xhr, status);
				}
			});
		}
		return config;
	}

	//	@description	fügt einen EsriLayer hinzu. (gecacht + dynamisch)
	//
	//	@argument		_url {String}
	//					URL zum AGS-Dienst
	//
	//	@argument		_layerParams {object}
	//					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html}
	//
	//	@argument		_sourceParams {object}
	//					zusätzliche Parameter für das OpenLayer-Source-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html}
	//
	//	@argument		_callbackFunction {function}
	//					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	//					Der Funktion wird das jeweilige Layerobjekt übergeben.
	//
	//	@since			v0.0
	var _addEsriLayer = function(_url, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;
		//Infos zu dem AGS Kartendienst ermitteln
		$.ajax({
			url: _url + "?f=json",
			type: "POST",
			dataType: "jsonp",
			success: function (ags_info) {
				//console.info(_url, ags_info);

				try {

					if (typeof(ags_info.error) != "undefined") {
						console.warn("Eigenschaften des Kartendienstes " + _url + " konnten nicht abgerufen werden.", ags_info.error);
						return;
					}

					//Copyright
					var url = new URL(_url);
					if (jQuery.inArray(url.hostname, _getConfig().ags_hosts) > -1) {
						if (ags_info.copyrightText == null || ags_info.copyrightText.length == 0) {
							ags_info.copyrightText = "© Stadtmessungsamt, LHS Stuttgart"
						}
					}

					//AGS Kartendienst von Esri?
					if (url.hostname.indexOf("arcgisonline.com")>-1 || url.hostname.indexOf("arcgis.com")>-1) {
						//Der Copyright-Vermerk muss immer sichtbar sein
						var _attributionControl = map.getControls().getArray().filter(function(_control) {
							return controlAttribution.prototype.isPrototypeOf(_control);
						})[0];
						_attributionControl.setCollapsible(false);
						_attributionControl.setCollapsed(false);
					}

					//spatialReference korrigieren für 10.0
					if (ags_info.currentVersion == 10.05 && ags_info.spatialReference.latestWkid == null) {
						switch (ags_info.spatialReference.wkid) {
							case 102100:
								ags_info.spatialReference.latestWkid = 3857;
							break;
						}
					}

					//spatialReference überprüfen
					if (projection != "EPSG:" + ags_info.spatialReference.wkid  && projection != "EPSG:" + ags_info.spatialReference.latestWkid) {
						console.warn("Projektion der Karte und des Kartendienstes stimmen nicht überein. Karte: " + projection + ", Kartendienst: EPSG:", ags_info.spatialReference.wkid + " / EPSG:" + ags_info.spatialReference.latestWkid, _url);
					}

					//Ist es ein gecachter Dienst?
					if (ags_info.singleFusedMapCache == true) {
						//-> gecachter Dienst hinzufügen
						_initCachedLayer(_url, _layerParams, _sourceParams, ags_info, _callbackFunction);
					} else {
						//-> dynamischer Dienst hinzufügen
						_initDynamicLayer(_url, _layerParams, _sourceParams, ags_info, _callbackFunction);
					}

				} catch (e) {
					console.error("Fehler beim Initalisieren des Layers " + _url, e);
				}
			},
			error: function (xhr, status) {
				console.error("OHOH", xhr, status);
			}
		});
	}

	//	@description	fügt einen gecachten WMTS-Kartendienst hinzu.
	//
	//	@argument		_url {String}
	//					GetCapabilities-URL zum WMTS
	//
	//	@argument		_layerName {String}
	//					Name des Layers, der eingebunden werden soll
	//
	//	@argument		_layerParams {object}
	//					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_layer_Layer-Layer.html}
	//
	//	@argument		_sourceParams {object}
	//					zusätzliche Parameter für das OpenLayer-Source-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_source_Source-Source.html}
	//
	//	@argument		_callbackFunction {function}
	//					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	//					Der Funktion wird das jeweilige Layerobjekt übergeben.
	//
	//	@since			v2.1
	var _addWMTSLayer = function(_url, _layerName, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		//GetCapabilities abrufen
		var url = new URL(_url);
		$.ajax({
			url: _url,
			type: "POST",
			success: function (wmtscapabilities) {
				var _formatWMTSCapabilities = new formatWMTSCapabilities();

				//sourceParams
				var sourceParams = sourceWMTS_optionsFromCapabilities(_formatWMTSCapabilities.read(wmtscapabilities), {
					layer: _layerName
				});

				//diese Parameter können nicht überdefiniert werden.
				var predefinedSourceParams = {};

				if (jQuery.inArray(url.hostname, _getConfig().wmts_hosts) > -1) {
					//URL-Parameter überdefinieren, da diese nicht korrekt ermittelt werden können.
					predefinedSourceParams.urls = [ url.origin + url.pathname + "/rest/" + _layerName + "/{style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}?format=image/png" ];
					predefinedSourceParams.requestEncoding = "REST";

					//Copyrighthinweis
					predefinedSourceParams.attributions = "© Stadtmessungsamt, LHS Stuttgart";
				}
				sourceParams = {
					...sourceParams,
					..._sourceParams,
					...predefinedSourceParams
				};

				var _zIndex = 10;
				//anderer zIndex für Stadtmessungsamt-Kartendienste
				if (jQuery.inArray(url.hostname, _getConfig().wmts_hosts) > -1) {
					_zIndex = 20;
				}

				//layerParams
				var layerParams = {
					zIndex: _zIndex
				};

				//diese Parameter können nicht überdefiniert werden.
				var predefinedLayerParams = {
					source: new sourceWMTS(sourceParams)
				};
				layerParams = {
					...layerParams,
					..._layerParams,
					...predefinedLayerParams
				};

				//gecachten Layer erstellen
				var layer = new layerTile(layerParams);

				//View konfigurieren, falls diese noch nicht konfiguriert wurde
				if (map.getView().getProjection().getCode() != projection) {
					map.setView(new View({
						...viewParams,
						...{ resolutions: sourceParams.tileGrid.getResolutions(), constrainResolution: true}
					}));
				}

				//Layer hinzufügen
				map.addLayer(layer);

				//Callbackfunktion ausführen
				if (typeof _callbackFunction == "function") {
					_callbackFunction(layer);
				}
			},
			error: function (xhr, status) {
				console.error("Fehler beim Abrufen der WMTS-GetCapabilities", xhr, status);
			}
		});
	}

	//	@description	fügt einen dynamischen WMS-Kartendienst hinzu.
	//					Der Layer kann gekachelt oder als ganzes Bild abgerufen werden. Standard ist der Abruf als ganzes Bild,
	//					da aber einige WMS-Dienste keine großen Bilder auf einmal zurückgeben können, kann der WMS auch gekachelt
	//					abgerufen werden. Dies kann zu Lasten der Kartographie gehen - so kann es passieren, dass Beschriftungen
	//					abgeschnitten oder mehrfach im Kartenbild enthalten sind.
	//					Zum gekachelten Abruf muss als _sourceParams { "TILED": true } übergeben werden.
	//
	//	@argument		_url {String}
	//					URL zum WMS
	//
	//	@argument		_layerName {String}
	//					Name des Layers, der eingebunden werden soll
	//
	//	@argument		_layerParams {object}
	//					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_layer_Layer-Layer.html}
	//
	//	@argument		_sourceParams {object}
	//					zusätzliche Parameter für das OpenLayer-Source-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_source_Source-Source.html}
	//
	//	@argument		_callbackFunction {function}
	//					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	//					Der Funktion wird das jeweilige Layerobjekt übergeben.
	//
	//	@since			v2.1
	var _addWMSLayer = function(_url, _layerName, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		//sourceParams
		var sourceParams = {
			url: _url,
			params: {"LAYERS": _layerName }
		};

		//diese Parameter können nicht überdefiniert werden.
		var predefinedSourceParams = {
			ratio: 1
		};

		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().wms_hosts) > -1) {
			//Copyrighthinweis
			predefinedSourceParams.attributions = "© Stadtmessungsamt, LHS Stuttgart";
		}

		sourceParams = {
			...sourceParams,
			..._sourceParams,
			...predefinedSourceParams
		};

		//Der Layer kann gekachelt oder als ganzes Bild abgerufen werden.
		if (sourceParams.TILED == true) {
			//gekachelter Abruf = gecacht

			var _zIndex = 10;
			//anderer zIndex für Stadtmessungsamt-Kartendienste
			if (jQuery.inArray(url.hostname, _getConfig().wms_hosts) > -1) {
				_zIndex = 20;
			}

			//layerParams
			var layerParams = {
				zIndex: _zIndex
			};

			//diese Parameter können nicht überdefiniert werden.
			var predefinedLayerParams = {
				source: new sourceTileWMS(sourceParams)
			};
			layerParams = {
				...layerParams,
				..._layerParams,
				...predefinedLayerParams
			};

			//Layer erstellen
			var layer = new layerTile(layerParams);

		} else {
			//Abruf als ein Bild = dynamisch

			var _zIndex = 40;
			//anderer zIndex für Stadtmessungsamt-Kartendienste
			if (jQuery.inArray(url.hostname, _getConfig().wms_hosts) > -1) {
				_zIndex = 50;
			}

			//layerParams
			var layerParams = {
				zIndex: _zIndex
			};

			//diese Parameter können nicht überdefiniert werden.
			var predefinedLayerParams = {
				source: new sourceImageWMS(sourceParams)
			};
			layerParams = {
				...layerParams,
				..._layerParams,
				...predefinedLayerParams
			};

			//Layer erstellen
			var layer = new layerImage(layerParams);
		}

		//View konfigurieren, falls diese noch nicht konfiguriert wurde
		if (map.getView().getProjection().getCode() != projection) {
			map.setView(new View({
				...viewParams,
				...{ constrainResolution: true}
			}));
		}

		//Layer hinzufügen
		map.addLayer(layer);

		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(layer);
		}
	}

	//	@description	fügt einen EsriLayer hinzu. (gecacht)
	//
	//	@argument		_url {String}
	//					URL zum AGS-Dienst
	//
	//	@argument		_layerParams {object}
	//					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html}
	//
	//	@argument		_sourceParams {object}
	//					zusätzliche Parameter für das OpenLayer-Source-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html}
	//
	//	@argument		ags_info {object}
	//					JSON-Objekt mit den Karteneigenschaften (von ../MapServer?f=json)
	//
	//	@argument		_callbackFunction {function}
	//					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	//					Der Funktion wird das jeweilige Layerobjekt übergeben.
	//
	//	@since			v0.0
	var _initCachedLayer = function (_url, _layerParams, _sourceParams, ags_info, _callbackFunction) {
		var _self = this;

		var resolutions = [];
		ags_info.tileInfo.lods.forEach(function(lod) {
			resolutions.push(lod.resolution);
		});

		var params =  {
			origin: [ags_info.tileInfo.origin.x, ags_info.tileInfo.origin.y],
			extent: [ags_info.fullExtent.xmin, ags_info.fullExtent.ymin, ags_info.fullExtent.xmax, ags_info.fullExtent.ymax],
			minZoom: 0,
			resolutions: resolutions,
			tileSize: [ags_info.tileInfo.rows, ags_info.tileInfo.cols]
		};
		var tileGrid = new TileGrid(params);

		//View konfigurieren, falls diese noch nicht konfiguriert wurde
		if (map.getView().getProjection().getCode() != projection) {
			map.setView(new View({
				...viewParams,
				...{ resolutions: resolutions, constrainResolution: true}
			}));
		}

		//Projektion ermitteln
		var projection;
		if (ags_info.spatialReference.latestWkid != null) {
			projection = ags_info.spatialReference.latestWkid;
		} else {
			projection = ags_info.spatialReference.wkid;
		}

		//sourceParams
		var sourceParams = {
			minZoom: '0'
		};

		//ToDo: XYZ-Dienst vorsehen? Anderer Server + Instanz?
		//diese Parameter können nicht überdefiniert werden.
		var predefinedSourceParams = {
			tileGrid: tileGrid,
			projection: getProjection("EPSG:" + projection),
			attributions: ags_info.copyrightText,
			url: _url + '/tile/{z}/{y}/{x}'
		};

		if (tileLoadFunction != null) {
			predefinedSourceParams.tileLoadFunction = tileLoadFunction;
		}
		sourceParams = {
			...sourceParams,
			..._sourceParams,
			...predefinedSourceParams
		};

		var _zIndex = 10;
		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().ags_hosts) > -1) {
			_zIndex = 20;
		}

		//layerParams
		var layerParams = {
			zIndex: _zIndex
		};

		//diese Parameter können nicht überdefiniert werden.
		var predefinedLayerParams = {
			source: new sourceXYZ(sourceParams)
		};
		layerParams = {
			...layerParams,
			..._layerParams,
			...predefinedLayerParams
		};

		//gecachten Layer erstellen
		var layer = new layerTile(layerParams);

		//Layer hinzufügen
		map.addLayer(layer);

		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(layer);
		}
	}

	//	@description	fügt einen EsriLayer hinzu. (dynamisch)
	//
	//	@argument		_url {String}
	//					URL zum AGS-Dienst
	//
	//	@argument		_layerParams {object}
	//					zusätzliche Parameter für das OpenLayer-Layer-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html}
	//
	//	@argument		_sourceParams {object}
	//					zusätzliche Parameter für das OpenLayer-Source-Objekt
	//					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html}
	//
	//	@argument		ags_info {object}
	//					JSON-Objekt mit den Karteneigenschaften (von ../MapServer?f=json)
	//
	//	@argument		_callbackFunction {function}
	//					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	//					Der Funktion wird das jeweilige Layerobjekt übergeben.
	//
	//	@since			v0.0
	var _initDynamicLayer = function (_url, _layerParams, _sourceParams, ags_info, _callbackFunction) {
		var _self = this;

		//sourceParams
		var sourceParams = {
			params: {layers: 'show:0'}
		};

		//diese Parameter können nicht überdefiniert werden.
		var predefinedSourceParams = {
			ratio: 1,
			url: _url,
			attributions: [ags_info.copyrightText]
		};
		sourceParams = {
			...sourceParams,
			..._sourceParams,
			...predefinedSourceParams
		};

		//layerParams
		var _zIndex = 40;
		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().ags_hosts) > -1) {
			_zIndex = 50;
		}

		//layerParams
		var layerParams = {
			zIndex: _zIndex //damit liegen die dynamischen Dienste über den gecachten Diensten (wenn nicht überkonfiguriert wird)
		};

		//diese Parameter können nicht überdefiniert werden.
		var predefinedLayerParams = {
			source: new sourceImageArcGISRest(sourceParams)
		};
		layerParams = {
			...layerParams,
			..._layerParams,
			...predefinedLayerParams
		};

		//dynamischen Layer erstellen
		var layer = new layerImage(layerParams);
		//Layer hinzufügen
		map.addLayer(layer);

		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(layer);
		}
	}

	// ----------------------------------------------------------------------------------
	// Public
	// ----------------------------------------------------------------------------------

	/**
	 *    @method            initMap
	 *    @description    initialisiert die Karte<br/>
	 *                    Beispiel:<br/>
	 *                    <code>mymap = new stma_openlayers();<br/>
	 *                    mymap.initMap(25832, {}, {});</code>
	 *
	 *    @argument        _epsgCode {int} EPSG-Code des Koordinatensystems.
	 *                    Unterstütze Werte sind: 25832, 3857<br/>
	 *                    Siehe auch: {@link https://epsg.io/25832}, {@link http://epsg.io/3857}
	 *
	 *    @argument        _mapParams {object}
	 *                    zusätzliche Parameter für das OpenLayer-Map-Objekt<br/>
	 *                    Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_Map-Map.html}
	 *
	 *    @argument        _viewParams {object}
	 *                    zusätzliche Parameter für das OpenLayer-View-Objekt<br/>
	 *                    Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_View-View.html}
	 *
	 *    @argument        _customParams {object}
	 *                    zusätzliche Parameter für geoline.ol.js<br/>
	 *                    Unterstützte Parameter:
	 *                    <ul>
	 *                    <li>tileLoadFunction: Optionale Funktion, die bei gecachten Kartendiensten ausgeführt wird, um eine Kachel zu laden.<br/>
	 *                        Beispiel:<br/>
	 *                        <code>{ tileLoadFunction: function(imageTile, src) { imageTile.getImage().src = src;}}</code><br/>
	 *                        Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_XYZ-XYZ.html}
	 *                    </li>
	 *
	 *                    <li>config: Hier kann das Konfigurationsobjekt, das normalerweise direkt vom Server des Stadtmessungsamtes geladen wird überschrieben werden.<br/>
	 *                        Diese Funktion sollte nur sparsam genutzt werden, zum Beispiel für die Offlineverfügbarkeit in Apps.<br/>
	 *                        Wird diese Funktion verwendet, so muss sichergestellt werden, dass die übergebene Konfiguration aktuell ist.
	 *                    </li>
	 *                    </ul>
	 *
	 *    @argument        _callbackFunction {function}
	 *                    Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
	 *                    Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *    @returns        {null} -
	 *
	 *    @since            v0.0
	 */
	stma_openlayers.prototype.initMap = function(_epsgCode, _mapParams, _viewParams, _customParams, _callbackFunction) {
		var _self = this;

		//(25832)UTM-Projektion zu den Projektionen von OpenLayers hinzufügen
		proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
		register(proj4);

		//(31467)GK-Projektion zu den Projektionen von OpenLayers hinzufügen
		proj4.defs("EPSG:31467", "+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs");
		register(proj4);

		//Projektion definieren
		projection = "EPSG:" + _epsgCode;
		if (getProjection(projection) == null) {
			console.error("Projektion " + projection + " nicht gefunden. Es kann zu falscher Darstellung der Karte kommen");
		}

		//zusätzliche Parameter für geoline.ol.js hinzufügen
		if (_customParams != null && _customParams.tileLoadFunction != null) {
			tileLoadFunction = _customParams.tileLoadFunction;
		}
		if (_customParams != null && _customParams.config != null) {
			console.warn("Konfiguration wurde manuell gesetzt und wird nicht vom Server des Stadtmessungamtes geladen. Bitte stellen Sie sicher, dass die Konfiguration immer aktuell ist.");
			config = _customParams.config;
		}

		//Karte initialisieren
		var mapParams = {
			target: "map",
			controls: defaultControls({
				attribution: true,
				attributionOptions: {
					tipLabel: "Copyright"
				}
			})
		};

		//diese Parameter können nicht überdefiniert werden.
		//Sie dürfen nicht geändert werden, da es sonst ggf. zu Problemen bei der Darstellung der Stadtmessungsamt-Kartendienste kommen kann.
		var predefinedMapParams = {
			logo: false,
			pixelRatio: 1, //wichtige Einstellung für unsere Kartendienste!
			loadTilesWhileAnimating: true, //Kacheln während des Zoomens nachladen
			loadTilesWhileInteracting: true //Kacheln während des Panens nachladen
		};
		mapParams = {
			...mapParams,
			..._mapParams,
			...predefinedMapParams
		};

		//Sicherstellen, dass der Attribution-Control vorhanden ist.
		//Dieser muss vorhanden sein, wenn Karten von ESRI genutzt werden.
		if (mapParams.controls != null) {
			var _attributionControlAvailable = false;
			mapParams.controls.forEach(function(_control, i) {
				if (controlAttribution.prototype.isPrototypeOf(_control)) {
					_attributionControlAvailable = true;
				}
			});
			if (_attributionControlAvailable == false) {
				//Attribution-Control hinzufügen
				mapParams.controls.push(new controlAttribution({
					tipLabel: "Copyright"
				}));
			}
		}

		//View definieren
		viewParams = {
			...{
				center: [513785, 5402232], // Stuttgart
				zoom: 2
			},
			..._viewParams,
			...{
				projection: getProjection(projection)
			}
		};

		//Karte definieren
		map = new Map(mapParams);

		//Rechtsklick auf der Karte unterbinden
		$(".ol-viewport").on("contextmenu", function(e) {
			e.preventDefault();
		});

		//Nach dem Start die Größe der Karte automatisch bestimmen
		map.updateSize();

		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(map);
		}
	}

	/**
	 *	@method			addEsriLayer
	 *	@description	fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) hinzu.<br/>
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					<ul>
	 *					<li>10: gecacht</li>
	 *					<li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
	 *					<li>40: dynamisch</li>
	 *					<li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
	 *					</ul>
	 *					Beispiel:<br/>
	 *					<code>mymap.addEsriLayer("https://server.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer");</code>
	 *
	 *	@argument		_url {String} URL des Kartendienstes
	 *					Kartendienste des Stadtmessungsamtes sollten über die Funktion addStmaEsriLayer hinzugefügt werden.
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html}
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.addEsriLayer = function(_url, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().ags_hosts) > -1) {
			console.error("Kartendienste des Stadtmessungsamtes über die Methode addStmaEsriLayer hinzufügen");
		} else {
			_addEsriLayer(_url, _layerParams, _sourceParams, _callbackFunction);
		}
	}

	/**
	 *	@method			addWMTSLayer
	 *	@description	fügt einen gecachten WMTS-Kartendienst hinzu.<br/>
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					<ul>
	 *					<li>10: gecacht</li>
	 *					<li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
	 *					<li>40: dynamisch</li>
	 *					<li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
	 *					</ul>
	 *					Beispiel:<br/>
	 *					<code>mymap.addWMTSLayer("https://SERVERNAME/INSTANZ/gwc/service/wmts?REQUEST=GetCapabilities", "LAYERNAME");</code>
	 *
	 *	@argument		_url {String} GetCapabilities-URL zum WMTS
	 *					Kartendienste des Stadtmessungsamtes sollten über die Funktion addStmaWMTSLayer hinzugefügt werden.
	 *
	 *	@argument		_layerName {String} Layername
	 *					Name des Layers, der eingebunden werden soll
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_layer_Layer-Layer.html}
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_source_Source-Source.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v2.1
	 */
	stma_openlayers.prototype.addWMTSLayer = function(_url, _layerName, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().wmts_hosts) > -1) {
			console.error("WMTS-Kartendienste des Stadtmessungsamtes über die Methode addStmaWMTSLayer hinzufügen");
		} else {
			_addWMTSLayer(_url, _layerName, _layerParams, _sourceParams, _callbackFunction);
		}
	}

	/**
	 *	@method			addWMSLayer
	 *	@description	fügt einen dynamischen WMS-Kartendienst hinzu.<br/>
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					<ul>
	 *					<li>10: gecacht</li>
	 *					<li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
	 *					<li>40: dynamisch</li>
	 *					<li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
	 *					</ul>
	 *					Beispiel:<br/>
	 *					<code>mymap.addWMSLayer("https://SERVERNAME/INSTANZ/gwc/service/wms", "LAYERNAME");</code>
	 *					<br/><br/>
	 *					Der Layer kann gekachelt oder als ganzes Bild abgerufen werden. Standard ist der Abruf als ganzes Bild,
	 *					da aber einige WMS-Dienste keine großen Bilder auf einmal zurückgeben können, kann der WMS auch gekachelt
	 *					abgerufen werden. Dies kann zu Lasten der Kartographie gehen - so kann es passieren, dass Beschriftungen
	 *					abgeschnitten oder mehrfach im Kartenbild enthalten sind.<br/>
	 *					Standardmäßig wird der WMS-Dienst als dynamischer Dienst behandelt, wenn der als gekachelter Dienst eingebunden wird,
	 *					wird er als gecachter Dienst behandelt (wichtig für die zIndexe der Kartendienste)
	 *					Zum gekachelten Abruf muss als _sourceParams <code>{ "TILED": true }</code> übergeben werden.<br/>
	 *					Beispiel:<br/>
	 *					<code>mymap.addWMSLayer("https://SERVERNAME/INSTANZ/gwc/service/wms", "LAYERNAME", {}, { "TILED": true });</code>
	 *
	 *
	 *	@argument		_url {String} URL zum WMS
	 *					Kartendienste des Stadtmessungsamtes sollten über die Funktion addStmaWMSLayer hinzugefügt werden.
	 *
	 *	@argument		_layerName {String} Layername
	 *					Name des Layers, der eingebunden werden soll
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_layer_Layer-Layer.html}
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_source_Source-Source.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v2.1
	 */
	stma_openlayers.prototype.addWMSLayer = function(_url, _layerName, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		var url = new URL(_url);
		if (jQuery.inArray(url.hostname, _getConfig().wms_hosts) > -1) {
			console.error("WMS-Kartendienste des Stadtmessungsamtes über die Methode addStmaWMSLayer hinzufügen");
		} else {
			_addWMSLayer(_url, _layerName, _layerParams, _sourceParams, _callbackFunction);
		}
	}

	/**
	 *	@method			addStmaEsriLayer
	 *	@description	fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) des Stadtmessungsamtes hinzu.<br/>
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					<ul>
	 *					<li>10: gecacht</li>
	 *					<li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
	 *					<li>40: dynamisch</li>
	 *					<li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
	 *					</ul>
	 *					Beispiel:<br/>
	 *					<code>mymap.addStmaEsriLayer("1_Base/Stadtkarte_Internet_c");</code>
	 *
	 *	@argument		_mapservice {String} Bezeichnung des Kartendienstes
	 *					Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer heißt,
	 *					so sollte ORDNER/KARTENDIENST angegeben werden.
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html}
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.addStmaEsriLayer = function(_mapservice, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		_addEsriLayer("https://" + _getConfig().ags_host + "/" + _getConfig().ags_instance + "/rest/services/" + _mapservice + "/MapServer", _layerParams, _sourceParams, _callbackFunction);
	}

	/**
	 *	@method			addStmaWMTSLayer
	 *	@description	fügt einen gecachten WMTS-Kartendienst des Stadtmessungsamtes hinzu.<br/>
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					<ul>
	 *					<li>10: gecacht</li>
	 *					<li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
	 *					<li>40: dynamisch</li>
	 *					<li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
	 *					</ul>
	 *					Beispiel:<br/>
	 *					<code>mymap.addStmaWMTSLayer("LAYERNAME");</code>
	 *
	 *	@argument		_layerName {String} Layername
	 *					Name des Layers, der eingebunden werden soll
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_layer_Layer-Layer.html}
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_source_Source-Source.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v2.1
	 */
	stma_openlayers.prototype.addStmaWMTSLayer = function(_layerName, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		//Matrix definieren - das was hier angegeben wird, kann nicht vom Nutzer überdefiniert werden.
		if (_sourceParams == null) {
			_sourceParams = {};
		}
		var _predefinedSourceParams = {
			matrixSet: _getConfig().wmts_matrix
		}
		_sourceParams = {
			..._sourceParams,
			..._predefinedSourceParams
		};
		_addWMTSLayer("https://" + _getConfig().wmts_host + "/" + _getConfig().wmts_instance + "/gwc/service/wmts?REQUEST=GetCapabilities", _layerName, _layerParams, _sourceParams, _callbackFunction);
	}

	/**
	 *	@method			addStmaWMSLayer
	 *	@description	fügt einen dynamischen WMS-Kartendienst des Stadtmessungsamtes hinzu.<br/>
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					<ul>
	 *					<li>10: gecacht</li>
	 *					<li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
	 *					<li>40: dynamisch</li>
	 *					<li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
	 *					</ul>
	 *					Beispiel:<br/>
	 *					<code>mymap.addStmaWMSLayer("LAYERNAME");</code>
	 *					<br/><br/>
	 *					Der Layer kann gekachelt oder als ganzes Bild abgerufen werden. Standard ist der Abruf als ganzes Bild,
	 *					da aber einige WMS-Dienste keine großen Bilder auf einmal zurückgeben können, kann der WMS auch gekachelt
	 *					abgerufen werden. Dies kann zu Lasten der Kartographie gehen - so kann es passieren, dass Beschriftungen
	 *					abgeschnitten oder mehrfach im Kartenbild enthalten sind.<br/>
	 *					Standardmäßig wird der WMS-Dienst als dynamischer Dienst behandelt, wenn der als gekachelter Dienst eingebunden wird,
	 *					wird er als gecachter Dienst behandelt (wichtig für die zIndexe der Kartendienste)
	 *					Zum gekachelten Abruf muss als _sourceParams <code>{ "TILED": true }</code> übergeben werden.<br/>
	 *					Beispiel:<br/>
	 *					<code>mymap.addStmaWMSLayer("LAYERNAME", {}, { "TILED": true });</code>
	 *
	 *	@argument		_layerName {String} Layername
	 *					Name des Layers, der eingebunden werden soll
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_layer_Layer-Layer.html}
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.5.0/apidoc/module-ol_source_Source-Source.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.<br/>
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v2.1
	 */
	stma_openlayers.prototype.addStmaWMSLayer = function(_layerName, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		//Tiled definieren - das was hier angegeben wird, kann nicht vom Nutzer überdefiniert werden.
		if (_sourceParams == null) {
			_sourceParams = {};
		}
		var _predefinedSourceParams = {
			TILED: _getConfig().wms_tiled
		}
		_sourceParams = {
			..._sourceParams,
			..._predefinedSourceParams
		};
		_addWMSLayer("https://" + _getConfig().wms_host + "/" + _getConfig().wms_instance, _layerName, _layerParams, _sourceParams, _callbackFunction);
	}

	/**
	 *	@method			addStmaBaseLayer
	 *	@description	fügt einen Basis-Kartendienst (dynamisch / gecacht) des Stadtmessungsamtes hinzu.<br/>
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					<ul>
	 *					<li>10: gecacht</li>
	 *					<li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
	 *					<li>40: dynamisch</li>
	 *					<li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
	 *					</ul>
	 *					Beispiel:<br/>
	 *					<code>
	 *						mymap.addStmaBaseLayer("Grundkarte");<br/>
	 *						mymap.addStmaBaseLayer("Luftbild");
	 *					</code>
	 *
	 *	@argument		_mapname {String} sprechende Bezeichnung des Kartendienstes
	 *					Für ausgewählte Basiskartendienste kann hierüber über eine sprechende Bezeichnung der Kartendienst hinzugefügt werden.
	 *					Eventuelle Kartendienstnamenänderungen werden automatisch von der API berücksichtigt.
	 *					Deswegen sollten die Basiskarten (Grundkarte, Luftbild, ..) immer über diese Funktion eingebundne werden.
	 *
	 *	@argument		_layerParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Layer-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_layer_Layer-Layer.html}
	 *
	 *	@argument		_sourceParams {object}
	 *					zusätzliche Parameter für das OpenLayer-Source-Objekt<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_source_Source-Source.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.addStmaBaseLayer = function(_mapname, _layerParams, _sourceParams, _callbackFunction) {
		var _self = this;

		if (_getConfig().ags_services != null && _getConfig().ags_services[_mapname] != null) {
			_addEsriLayer("https://" + _getConfig().ags_services[_mapname].ags_host + "/" + _getConfig().ags_services[_mapname].ags_instance + "/rest/services/" + _getConfig().ags_services[_mapname].ags_service + "/MapServer", _layerParams, _sourceParams, _callbackFunction);
		} else
		if (_getConfig().wmts_services != null && _getConfig().wmts_services[_mapname] != null) {

			//GetCapabilities-URL
			var _urlGetCapabilities = "https://" + _getConfig().wmts_services[_mapname].host + "/" + _getConfig().wmts_services[_mapname].instance + "/gwc/service/wmts?REQUEST=GetCapabilities"

			//Matrix definieren - das was hier angegeben wird, kann nicht vom Nutzer überdefiniert werden.
			if (_sourceParams == null) {
				_sourceParams = {};
			}
			var _predefinedSourceParams = {
				matrixSet: _getConfig().wmts_services[_mapname].matrix
			}
			_sourceParams = {
				..._sourceParams,
				..._predefinedSourceParams
			};
			_addWMTSLayer(_urlGetCapabilities, _getConfig().wmts_services[_mapname].service, _layerParams, _sourceParams, _callbackFunction);
		} else
		if (_getConfig().wms_services != null && _getConfig().wms_services[_mapname] != null) {

			//URL
			var _url = "https://" + _getConfig().wms_services[_mapname].host + "/" + _getConfig().wms_services[_mapname].instance

			//Tiled definieren - das was hier angegeben wird, kann nicht vom Nutzer überdefiniert werden.
			if (_sourceParams == null) {
				_sourceParams = {};
			}
			var _predefinedSourceParams = {
				TILED: _getConfig().wms_services[_mapname].tiled
			}
			_sourceParams = {
				..._sourceParams,
				..._predefinedSourceParams
			};
			_addWMSLayer(_url, _getConfig().wms_services[_mapname].service, _layerParams, _sourceParams, _callbackFunction);
		} else {
			console.error("Karte '" + _mapname + "' nicht gefunden");
		}
	}

	/**
	 *	@method			addPoints
	 *	@description	fügt einzelne Punkte hinzu.<br/>
	 *					Wenn nichts anderes angegeben ist, dann gilt der zIndex 60.<br/>
	 *
	 *					Beispiel:<br/>
	 *					<code>mymap.addPoints([[3513223, 5405026]], "images/target.png");</code>
	 *
	 *	@argument		_pointCoords {Array} Array von Koordinatenpaaren<br/>
	 *					[ [x,y], [x,y], ... ]
	 *
	 *	@argument		_imageURL {String} URL zu dem Bild des Punktes / Data-URL des Bildes
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.addPoints = function(_pointCoords, _imageURL, _callbackFunction) {

		var features = [];
		for (var i=0; i < _pointCoords.length; i++) {
			features.push(new Feature({
				geometry: new geomPoint(_pointCoords[i])
			}));
		}

		var vectorLayer = new layerVector({
			zIndex: 60,
			source: new sourceVector({
				features: features
			}),
			style: new styleStyle({
				image: new styleIcon({
					anchor: [0.5, 1],
					src: _imageURL
				})
			})
		});
		map.addLayer(vectorLayer);

		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(vectorLayer);
		}
	}

	/**
	 *	@method			addGeoJSONfromURL
	 *	@description	fügt Objekte aus einem geoJSON hinzu. Das geoJSON ist über eine URL erreichbar.<br/>
	 *
	 *					Beispiel:
	 *					<code>mymap.addGeoJSONfromURL("examples/example.geojson");</code>
	 *
	 *	@argument		_url {String} URL zur geoJSON-Datei
	 *
	 *	@argument		_style {object} (optional) Ausprägungs-Details<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_style_Style-Style.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben. Der Funktion wird false übergeben, wenn das GeoJSON
	 *					nicht abgerufen werden konnte.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v2.0
	 */
	stma_openlayers.prototype.addGeoJSONfromURL = function(_url, _zoomTo, _style, _callbackFunction) {
		fetch(_url)
			.then(response => {
				if (!response.ok) {
					throw new Error('Network response was not ok');
				}
				return response.json();
			})
			.then(geojson => {
				this.addGeoJSON(geojson, _zoomTo, _style, _callbackFunction);
			})
			.catch(error => {
				console.error("JSON konnte von URL " + _url + " nicht abgerufen werden.", error);

				// Callbackfunktion ausführen
				if (typeof _callbackFunction === "function") {
					_callbackFunction(false);
				}
			});
	}

	/**
	 *	@method			addGeoJSON
	 *	@description	fügt Objekte aus einem geoJSON hinzu.
	 *
	 *					Beispiel:
	 *					<code>mymap.addGeoJSON(_geojson);</code>
	 *
	 *	@argument		_geojson {object} GeoJSON-Objekt
	 *
	 *	@argument		_style {object} (optional) Ausprägungs-Details<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_style_Style-Style.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v2.0
	 */
	stma_openlayers.prototype.addGeoJSON = function(_geojson, _zoomTo, _style, _callbackFunction) {

		var _projectionGeoJSON = "EPSG:4326";
		//Wurde das Koordinatensystem angegeben?
		if ("crs" in _geojson) {
			if ("properties" in _geojson.crs) {
				if ("name" in _geojson.crs.properties) {
					_projectionGeoJSON = _geojson.crs.properties.name;
				}
			}
		}

		//Bei urn:ogc:def:crs:OGC:1.3:CRS84 wird unter Verwendung von UTM(EPSG:25832) nicht korrekt transformiert.
		if (_projectionGeoJSON == "urn:ogc:def:crs:OGC:1.3:CRS84") {
			_projectionGeoJSON = "EPSG:4326";
		}

		if (getProjection(_projectionGeoJSON) == null) {
			console.error("Projektion " + _projectionGeoJSON + " nicht gefunden. Es kann zu falscher Darstellung der Karte kommen");
		}

		var _geojsonFormat = new formatGeoJSON({
			dataProjection: _projectionGeoJSON,
			featureProjection: projection
		})

		var _vectorSource = new sourceVector({
			features: _geojsonFormat.readFeatures(_geojson)
		});

		var vectorLayer = new layerVector({
			zIndex: 60,
			source: _vectorSource,
			style: _style
		});

		map.addLayer(vectorLayer);

		if (_zoomTo == true) {
			//warte bis View bereit ist.
			var zoomToInterval = window.setInterval(function() {
				if (map.getView().getZoom() != "undefined") {
					clearInterval(zoomToInterval);
					map.getView().fit(_vectorSource.getExtent());
				}
			}, 500);
		}

		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(vectorLayer);
		}
	}

	/**
	 *	@method			addOverlayForLayer
	 *	@description	Bietet die Möglichkeit an für einen Layer ein Overlay hinzuzufügen.
	 *
	 *					Beispiel:
	 *					<code>mymap.addOverlayForLayer(_layer, _overlayFunction);</code>
	 *
	 *	@argument		_layer {object} Das Layerobjekt
	 *
	 *	@argument		_overlayFunction {function}
	 *					Funktion, die bei einem Klick auf das Objekt ausgeführt wird.
	 *					Die Funktion muss den HTML-Inhalt für ein Overlay-Fenster zurückgeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v1.2
	 */
	stma_openlayers.prototype.addOverlayForLayer = function(_layer, _overlayFunction) {

		//globaler Overlay-Layer hinzufügen
		if (overlayLayer == null) {
			if ($(map.getTargetElement()).find("#geoline_ol_js_popup").length == 0) {
				//Element für Overlay definieren
				$(map.getTargetElement()).append("<div id='geoline_ol_js_popup'/>");
			}
			var _overlayDIV = $(map.getTargetElement()).find("#geoline_ol_js_popup").get(0);

			overlayLayer = new Overlay({
				element: _overlayDIV,
			});
			map.addOverlay(overlayLayer);

			map.on('click', function (evt) {
				var featuredata = map.forEachFeatureAtPixel(
					evt.pixel,
					function (_feature, _layer) {
						return {
							"feature": _feature,
							"layer": _layer
						};
					},
					{
						layerFilter: function(_layerCandidate) {
							//Filter, damit nur die Features gefunden werden, für die auch der Overlay aktiviert wurde.
							if (overlayLayers.includes(_layerCandidate)) {
								return true;
							} else {
								return false;
							}
						}
					}
				);
				if (featuredata) {
					var _overlayFunction = overlayFunctions[overlayLayers.indexOf(featuredata.layer)];

					$(overlayLayer.getElement()).html(
						'<div class="arrow"></div>' +
						'<div class="content">' + _overlayFunction(featuredata.feature) + '</div>'
					);

					overlayLayer.setPosition(evt.coordinate);
					$(_overlayDIV).show();

					var _transform = "translate3d(-" + $(_overlayDIV).width()/2 + "px, calc(-" + $(_overlayDIV).height() + "px - 0.5rem), 0px)";
					$(_overlayDIV).css("transform", _transform);
				} else {
					$(_overlayDIV).hide();
				}
			});
		}

		//Füge Layer zu den Layern hinzu, für die das Overlay aktiviert ist.
		if (!overlayLayers.includes(_layer)) {
			overlayLayers.push(_layer);
			overlayFunctions[overlayLayers.indexOf(_layer)] = _overlayFunction;
		}
	}

	/**
	 *	@method			addStmaEsriFeatureLayer
	 *	@description	fügt einen Kartendienst eines ArcGIS Servers (dynamisch / gecacht) des Stadtmessungsamtes hinzu.
	 *					Wenn nichts anderes angegeben ist, dann gelten folgende zIndexe für die Kartendienste:
	 *					<ul>
	 *					<li>10: gecacht</li>
	 *					<li>20: gecacht - Kartendienst des Stadtmessungsamtes</li>
	 *					<li>40: dynamisch</li>
	 *					<li>50: dynamisch - Kartendienst des Stadtmessungsamtes</li>
	 *					</ul>
	 *
	 *					Beispiel:<br/>
	 *					<code>mymap.addStmaEsriFeatureLayer("1_Base/Stadtkarte_Internet_c");</code>
	 *
	 *	@argument		_mapservice {String} Bezeichnung des Kartendienstes
	 *					Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer heißt,
	 *					so sollte ORDNER/KARTENDIENST angegeben werden.
	 *
	 *	@argument		_layerId {Integer} LayerId im Kartendienst
	 *					Wenn die URL des Kartendienstes beispielsweise https://SERVER/ArcGIS/rest/services/ORDNER/KARTENDIENST/MapServer/LAYERID heißt,
	 *					so sollte LAYERID angegeben werden.
	 *
	 *	@argument		_styleFunction {function}
	 *					Funktion, wie die Objekte aussehen sollen. Der Funktion wird als 1. Parameter das feature-Objekt (ol.Feature) übergeben.
	 *					Mit Hilfe von z.B. feature.get('activeprod') könnte dann der Inhalt des Attributes 'activeprod' abgerufen werden und in Abhängigkeit
	 *					von ihm unterschiedliche Stile angegeben werden.
	 *					Rückgabe der Funktion muss ein ol.style.Style-Objekt sein.<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_style_Style-Style.html}
	 *
	 *	@argument		_callbackFunction {function}
	 *					Möglichkeit, eine Funktion zu übergeben, die nach dem Hinzufügen des Layers ausgeführt wird.
	 *					Der Funktion wird das jeweilige Layerobjekt übergeben.
	 *
	 *	@returns		{null} -
	 *
	 *	@since			v0.86
	 */
	stma_openlayers.prototype.addStmaEsriFeatureLayer = function(_mapservice, _layerId, _styleFunction, _callbackFunction) {
		var _self = this;

		var _epsgCode = projection.replace("EPSG:", "");

		var _esrijsonFormat = new formatEsriJSON();

		var vectorSource = new sourceVector({
			loader: function(_extent, _resolution, _projection) {
				var _url = "https://" + _getConfig().ags_host + "/" + _getConfig().ags_instance + "/rest/services/" + _mapservice + "/MapServer/" + _layerId + "/query/";

				var _urlParams = {
					"f": "json",
					"returnGeometry": true,
					"spatialRel": "esriSpatialRelIntersects",
					"geometry":  encodeURIComponent('{"xmin":' + _extent[0] + ',"ymin":' + _extent[1] + ',"xmax":' + _extent[2] + ',"ymax":' + _extent[3] + ',"spatialReference":{"wkid":' + _epsgCode + '}}'),
					"geometryType": "esriGeometryEnvelope",
					"inSR": _epsgCode,
					"outFields": "*",
					"outSR": _epsgCode
				};

				$.ajax({
					method: "POST",
					url: _url,
					data: _urlParams,
					dataType: 'jsonp',
					success: function(_response) {
						if (_response.error) {
							alert(_response.error.message + '\n' + _response.error.details.join('\n'));
						} else {
							var features = _esrijsonFormat.readFeatures(_response, {
								featureProjection: _projection
							});
							if (features.length > 0) {
								vectorSource.addFeatures(features);
							}
						}
					}
				});
			},
			strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
				tileSize: 512
			}))
		});

		var vectorLayer = new layerVector({
			zIndex: 60,
			source: vectorSource,
			style: _styleFunction
		});

		map.addLayer(vectorLayer);

		//Callbackfunktion ausführen
		if (typeof _callbackFunction == "function") {
			_callbackFunction(vectorLayer);
		}
	}

	/**
	 *	@method			getMap
	 *	@description	gibt das OpenLayer-Map-Objekt zurück.<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_Map-Map.html}
	 *
	 *	@returns		{object} ol.Map<br/>
	 *					Siehe {@link https://openlayers.org/en/v6.3.1/apidoc/module-ol_Map-Map.html}
	 *
	 *	@since			v0.0
	 */
	stma_openlayers.prototype.getMap = function() {
		return map;
	}

	/**
	 *	@method			getConfig
	 *	@description	gibt die interne Konfiguration von geoline.ol.js zurück.<br/>
	 *					Diese Funktion sollte nur sparsam genutzt werden, zum Beispiel zum Ermitteln der Konfiguration für die Offlineverfügbarkeit in Apps.
	 *
	 *	@returns		{object}
	 *
	 *	@since			v1.0
	 */
	stma_openlayers.prototype.getConfig = function() {
		return _getConfig();
	}

	return stma_openlayers;
}());
export default stma_openlayers;
