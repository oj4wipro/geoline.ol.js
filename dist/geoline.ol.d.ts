/**
 *	version			2.1.0
 */
/**
 *	@method			StmaOpenLayers
 *	@description	Momentan ist OpenLayers 6.3.1 eingebunden.
 *
 *	@param			{string} [_configUrl="https://gis5.stuttgart.de/geoline/geoline.config/config.aspx"]
 *					Basis-URL für den Abruf der Geoline-Basiskonfiguration. Wird als vorbelegter Parameter verwendet.
 *
 *	@returns		{null} -
 *
 *	@since			v0.0
 */
declare let StmaOpenLayers: {
    new (_configUrl?: string): {
        initMap(_epsgCode: int, _mapParams?: object, _viewParams?: object, _customParams?: object, _callbackFunction?: Function): null;
        addEsriLayer(_url: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addWMTSLayer(_url: string, _layerName?: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addWMSLayer(_url: string, _layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addStmaEsriLayer(_mapservice: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addStmaWMTSLayer(_layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addStmaWMSLayer(_layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addStmaBaseLayer(_mapname: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addPoints(_pointCoords: any[], _imageURL: string, _callbackFunction?: Function): null;
        addGeoJSONfromURL(_url: string, _zoomTo?: boolean, _style?: object, _callbackFunction?: Function): null;
        addGeoJSON(_geojson: object, _zoomTo?: boolean, _style?: object, _callbackFunction?: Function): null;
        addOverlayForLayer(_layer: object, _overlayFunction?: Function): null;
        addStmaEsriFeatureLayer(_mapservice: string, _layerId: integer, _styleFunction?: Function, _callbackFunction?: Function): null;
        getMap(): object;
        getConfig(): object;
    };
};
export const stma_openlayers: {
    new (_configUrl?: string): {
        initMap(_epsgCode: int, _mapParams?: object, _viewParams?: object, _customParams?: object, _callbackFunction?: Function): null;
        addEsriLayer(_url: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addWMTSLayer(_url: string, _layerName?: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addWMSLayer(_url: string, _layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addStmaEsriLayer(_mapservice: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addStmaWMTSLayer(_layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addStmaWMSLayer(_layerName: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addStmaBaseLayer(_mapname: string, _layerParams?: object, _sourceParams?: object, _callbackFunction?: Function): null;
        addPoints(_pointCoords: any[], _imageURL: string, _callbackFunction?: Function): null;
        addGeoJSONfromURL(_url: string, _zoomTo?: boolean, _style?: object, _callbackFunction?: Function): null;
        addGeoJSON(_geojson: object, _zoomTo?: boolean, _style?: object, _callbackFunction?: Function): null;
        addOverlayForLayer(_layer: object, _overlayFunction?: Function): null;
        addStmaEsriFeatureLayer(_mapservice: string, _layerId: integer, _styleFunction?: Function, _callbackFunction?: Function): null;
        getMap(): object;
        getConfig(): object;
    };
};
export { StmaOpenLayers as default };
