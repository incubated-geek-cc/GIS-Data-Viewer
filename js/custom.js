document.addEventListener('DOMContentLoaded', () => {
	/*
	GeoJSON Specs: https://datatracker.ietf.org/doc/html/rfc7946/
	ArcGIS: https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-GeoJSONLayer.html
	https://gis.stackexchange.com/questions/38863/how-to-render-a-table-with-mixed-geometry-types-in-qgis
	*/
	const panelTabs = document.getElementById('panelTabs');
	const panelTabsCollection = panelTabs.getElementsByTagName('a');
	Array.from(panelTabsCollection).map(tab => new BSN.Tab( tab, {height: true} ));
	const tableTab = panelTabsCollection[0];
	const tableTabInit = tableTab.Tab;
	tableTabInit.show();

	const elementsTooltip = document.querySelectorAll('[title]');
	Array.from(elementsTooltip).map(
	  tip => new BSN.Tooltip( tip, {
	    placement: 'top', //string
	    animation: 'slideNfade', // CSS class
	    delay: 150, // integer
	  })
	);

	if (!window.FileReader) {
        alert('Your browser does not support HTML5 "FileReader" function required to open a file.');
        return;
    }
    if (!window.Blob) {
        alert('Your browser does not support HTML5 "Blob" function required to save a file.');
        return;
    }
	const jsonObjToHTMLTable = (jsonObj) => {
		let output='<div class="table-responsive-sm"><table class="table table-bordered table-sm m-0">';
		for(let keyIndex in jsonObj) {
			try {
				output+='<tr>';
				output+=`<th>${keyIndex}</th>`;
				output+=`<td>${jsonObj[keyIndex]}</td>`;
				output+='</tr>';
			} catch(err) { }
		}
		output+='</table></div>';
		return output;
	};
	
	function syntaxHighlight(json) {
        json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
	            var cls = "number";
	            if (/^"/.test(match)) {
	                if (/:$/.test(match)) {
	                    cls = "key";
	                } else {
	                    cls = "string";
	                }
	            } else if (/true|false/.test(match)) {
	                cls = "boolean";
	            } else if (/null/.test(match)) {
	                cls = "null";
	            }
            return "<span class='" + cls + "'>" + match + "</span>";
        });
    }

	function highlightJSON(elementId, jsonObj) {
	    let elementContainer=document.getElementById(elementId);
	    elementContainer.innerHTML='';
	    elementContainer.appendChild(document.createElement("pre")).innerHTML=syntaxHighlight(JSON.stringify(jsonObj, undefined, 2));

	    let preElements = elementContainer.getElementsByTagName("pre");
	    for(let p of preElements) {
	        p["style"]["padding"]="2.5px";
	        p["style"]["margin"]="5px";
	        p["style"]["white-space"]="pre-wrap";
	    }
	    let stringElements = elementContainer.getElementsByClassName("string");
	    for(let s of stringElements) {
	        s["style"]["color"]="green";
	    }
	    let numberElements = elementContainer.getElementsByClassName("number");
	    for(let n of numberElements) {
	        n["style"]["color"]="darkorange";
	    }
	    let booleanElements = elementContainer.getElementsByClassName("boolean");
	    for(let b of booleanElements) {
	        b["style"]["color"]="blue";
	    }
	    let nullElements = elementContainer.getElementsByClassName("null");
	    for(let n of nullElements) {
	        n["style"]["color"]="magenta";
	    }
	    let keyElements = elementContainer.getElementsByClassName("key");
	    for(let k of keyElements) {
	        k["style"]["color"]="red";
	    }
	}

	// Note: Compatible for both IE8, IE9+ and other modern browsers
	function triggerEvent(el, type) {
	    let e = ( ('createEvent' in document) ? document.createEvent('HTMLEvents') : document.createEventObject() );
	    if ('createEvent' in document) { 
	      e.initEvent(type, false, true);
	      el.dispatchEvent(e);
	    } else { 
	      e.eventType = type;
	      el.fireEvent('on' + e.eventType, e);
	    }
	}
	
	const mapContainer=document.getElementById('map');

	const resetMapViewBtn=document.getElementById('resetMapViewBtn');
	const clearAllBtn=document.getElementById('clearAllBtn');

	const inputSpatialFormatDDL = document.getElementById('inputSpatialFormat');
	const inputSpatialFormatBtn = document.getElementById('inputSpatialFormatBtn');

	const outputSpatialFormatDDL=document.getElementById('outputSpatialFormat');
	const outputSpatialFormatBtn=document.getElementById('outputSpatialFormatBtn');

	const mapPropsDatatableContainer=document.getElementById('mapPropsDatatableContainer');

	function htmlToElement(html) {
	    if (!(document.createElement("template").content)) {
	        alert('Your browser does not support "template".');
	        return;
	    }
	    let documentFragment = document.createDocumentFragment();
	    let template = document.createElement('template');
	    template.innerHTML = html.trim();
	    for (let i = 0, e = template.content.childNodes.length; i < e; i++) {
	        documentFragment.appendChild(template.content.childNodes[i].cloneNode(true));
	    }
	    return documentFragment;
	}

	const delField = '✕';
	const mergeField = '⧉';
	const nilField = '';

	const fileExtMapper = {
		'GEOJSON':'.geojson,.json',
		'KML':'.kml,.xml',
		'SHP':'.zip'
	};
	inputSpatialFormatDDL.addEventListener('change', ()=> {
		let fileExt=fileExtMapper[inputSpatialFormatDDL.value];
		inputSpatialFormatBtn.setAttribute('accept',fileExt);
	});

	let mapPropsDatatable;
	let uploadSpatialFileIs, uploadedGeojsonObj;

	let mapGeojsonObj, pointGeojsonObj;
	let mapLayer, pointLayer;

	let toDel = {};
	let layerBounds;
	
	const map = L.map('map', {
		zoomControl: false
	});

	const scale = L.control.scale({
      maxWidth: 100,
      metric: true,
      imperial: true,
      position: 'bottomleft'
    });

	const zoomControl=L.control.zoom({ 
		position: 'topleft' 
	});

	const attributionControl = L.control.attribution({
      prefix: '<span class="prefix-attribution pr-1 pl-1"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAAXNSR0IArs4c6QAAAXZJREFUKFNjZMABZp5JYxVm+az2+z/DpkjD5cowZYzY1IMUi/P+7Pzz+3cMJze76LMHH2VTHdc9AanF0DDjYLCqjBzfLCYmJoffv34zsLAyM7x/+a0rxnxlOYaGpaejlLgF2FaxszMb//r5m+HL528MQiL8DN++/L4arLVIB0PDxlvx69g4WAJBEm9evWfg4eVi4OBkZ/j7l+Gqj+JcVA2zDgb5ySoIboQ58trFuwxa+nC/XvWUQ9Ow8XbCFTZ2Zm2Q6dcv3mXQ0FNiYGSEePHv739XfZTno9qw/VHyFQYGBu3PH78yPH/8mkFNRwEegF8+/DwYqrfEAcUPMA33bz1hEBEXZODl54ZrePHgc2Ci3aoNKBo230s88OvnL/t7Nx8zqOsoMrCysUCc8/f/Bx/FeYIYETf3cLg+A8P3+p+/fgUqqkpDFP/59/Pzh19ZkUZL52GN6YJ+AwETO/V6QWHuvF8//rz9/u13Jgv7n81h2qt/wTQAAJeGjg3D55B1AAAAAElFTkSuQmCC" /><a href="https://leafletjs.com/" title="A JavaScript library for interactive maps" target="_blank">Leaflet</a> | <span class="symbol">© Created by</span> <a href="https://medium.com/@geek-cc" target="_blank"> ξ(</span><span class="emoji">🎀</span><span class="symbol">˶❛◡❛) ᵀᴴᴱ ᴿᴵᴮᴮᴼᴺ ᴳᴵᴿᴸ</span></a></span>',
      position: 'bottomright'
    });

	let customIcon = L.Icon.extend({
	    options: {
	      iconSize:     [24, 24], // size of the icon
	      iconAnchor:   [24, 12], // point of the icon which will correspond to marker's location
	      popupAnchor:  [-6, -12] // point from which the popup should open relative to the iconAnchor
	    }
	});
	let markerIcon = new customIcon({
		iconUrl: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gU3ZnIFZlY3RvciBJY29ucyA6IGh0dHA6Ly93d3cub25saW5ld2ViZm9udHMuY29tL2ljb24gLS0+DQo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPg0KPHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMjU2IDI1NiIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+DQo8bWV0YWRhdGE+IFN2ZyBWZWN0b3IgSWNvbnMgOiBodHRwOi8vd3d3Lm9ubGluZXdlYmZvbnRzLmNvbS9pY29uIDwvbWV0YWRhdGE+DQo8Zz48Zz48Zz48cGF0aCBmaWxsPSIjNjE2MzY2IiBkPSJNMTI4LDEwYy00OC45LDAtODguNSwzOS42LTg4LjUsODguNUMzOS41LDE0Ny40LDEyOCwyNDYsMTI4LDI0NnM4OC41LTk4LjYsODguNS0xNDcuNUMyMTYuNSw0OS42LDE3Ni45LDEwLDEyOCwxMHogTTEyOCwxNTcuNWMtMzIuNiwwLTU5LTI2LjQtNTktNTljMC0zMi42LDI2LjQtNTksNTktNTljMzIuNiwwLDU5LDI2LjQsNTksNTlDMTg3LDEzMS4xLDE2MC42LDE1Ny41LDEyOCwxNTcuNXoiLz48L2c+PC9nPjwvZz4NCjwvc3ZnPg==',
		className: 'input-feature rounded-circle'
	});

	const command = L.control({
    	position: 'topright'
	});
	command.onAdd = function(map) {
		let div = L.DomUtil.create("div", "command");
		let htmlStr = "";
		htmlStr += "<div class='leaflet-control-layers leaflet-control leaflet-control-layers-expanded m-0 p-1'>";
		htmlStr += "<div class='leaflet-control-layers-base w-100'>";
		htmlStr += "<details open>";
		htmlStr += "<summary><strong>Map Bounds</strong></summary>";
		htmlStr += "<div id='map-bounds' class='border border-0 m-0 w-100'>";
		htmlStr += "<div class='leaflet-control-layers-overlays'>";
		htmlStr += "<table class='table table-bordered table-condensed table-sm m-0'>";
		htmlStr += "<tr><th colspan='2'><u>X Field:</u></th></tr>";
		htmlStr += "<tr><th>X</th><td>(Longitude)</td></tr>";
		htmlStr += "<tr><th>Left:</th><td id='imgBounds_Left'></td></tr>";
		htmlStr += "<tr><th>Right:</th><td id='imgBounds_Right'></td></tr>";
		htmlStr += "<tr><th colspan='2'><u>Y Field:</u></th></tr>";
		htmlStr += "<tr><th>Y</th><td>(Latitude)</td></tr>";
		htmlStr += "<tr><th>Bottom:</th><td id='imgBounds_Bottom'></td></tr>";
		htmlStr += "<tr><th>Top:</th><td id='imgBounds_Top'></td></tr>";
		htmlStr += "</table>";
		htmlStr += "</div>";
		htmlStr += "</details>";
		htmlStr += "</div>";
		htmlStr += "</div>";	
		
		div.innerHTML = htmlStr; 
		return div;
	};
	command.addTo(map);

	const imgBounds_Left=document.getElementById('imgBounds_Left');
	const imgBounds_Right=document.getElementById('imgBounds_Right');
	const imgBounds_Bottom=document.getElementById('imgBounds_Bottom');
	const imgBounds_Top=document.getElementById('imgBounds_Top');

	function renderFillerTable() {
		// console.log([mapPropsDatatableContainer,mapPropsDatatable]);
		if(typeof mapPropsDatatable !== 'undefined') {
			mapPropsDatatableContainer.removeChild(mapPropsDatatable);
		}
		mapPropsDatatable = document.createElement('table');
    	mapPropsDatatable.id='mapPropsDatatable';
    	mapPropsDatatable.setAttribute('class','table table-bordered table-condensed table-sm m-0 h-100');
    	let tbodyRow=htmlToElement('<tr><td class="text-center table-placeholder"><h2 class="text-muted"><span class="symbol mr-1">📄</span>No File Found</h2></td></tr>');
    	mapPropsDatatable.appendChild(tbodyRow);
    	mapPropsDatatableContainer.appendChild(mapPropsDatatable);

    	let displayGeoJSONObj = {
						  		"type": "FeatureCollection",
						  		"features": []
					  		};
  		highlightJSON('geojsonDisplayContainer', displayGeoJSONObj);
	}

	function renderImageBounds() {
		if(typeof mapLayer !== 'undefined' || typeof pointLayer !== 'undefined') {
			imgBounds=map.getBounds();
			imgBounds_Left.innerHTML=imgBounds._southWest.lng;
			imgBounds_Right.innerHTML=imgBounds._northEast.lng;

			imgBounds_Bottom.innerHTML=imgBounds._southWest.lat;
			imgBounds_Top.innerHTML=imgBounds._northEast.lat;
		}
	}
	
	function addMultipleEvents(eventsArray, targetElem, handler) {
		eventsArray.map((event) => targetElem.on(event, handler));
	}
	addMultipleEvents(['zoomend', 'dragend', 'viewreset', 'moveend', 'load', 'resize'], map, renderImageBounds);

	const json2tableOptions = {
        prependHeader: true,
        sortHeader: true,
        trimFieldValues: true,
        trimHeaderFields: true,
        emptyFieldValue: '',
        delimiter: {
            field: '</td><td>', // delimiter (,)
            wrap: '',
            eol: '</td></tr><tr><td>' // \n breakline
        }
    };

	function unionPolygons(inputGeojsonObj, propToCombine) {
		let nonPolyFeaturesArr=[];

		let geojsonInputFeatures=inputGeojsonObj['features'];
        let uniquePropValues={};
        let uniquePropObjs={};
        let featurePropsCopy={};
        for(let g in geojsonInputFeatures) {
            let geojsonInputFeature=geojsonInputFeatures[g];
            let featureProps=geojsonInputFeature['properties'];

            featurePropsCopy=JSON.parse(JSON.stringify(featureProps));

            let featureGeometry=geojsonInputFeature['geometry'];
            let featureGeometryType=featureGeometry['type'];

            let uniquePropValue=featureProps[propToCombine];
            if(typeof uniquePropValues[uniquePropValue]=='undefined') {
                uniquePropValues[uniquePropValue]=[];
            }

            if(featureGeometryType=='Polygon') {
                let coordinates=featureGeometry['coordinates'];
                uniquePropValues[uniquePropValue].push(coordinates);
            } else if(featureGeometryType=='MultiPolygon') {
                let multiPolyCoords=featureGeometry['coordinates'];
                for(let m1 in multiPolyCoords) {
                    for(let m2 in multiPolyCoords[m1]) {
                        let polyCoords=[multiPolyCoords[m1][m2]];
                        uniquePropValues[uniquePropValue].push(polyCoords);
                    }
                }
            } else if(featureGeometryType=='GeometryCollection') {
                let geometriesArr=featureGeometry['geometries'];
                for(let g2 in geometriesArr) {
                    let geometrySubObj=geometriesArr[g2];
                    let geometrySubType=geometrySubObj['type'];
                    if(geometrySubType=='Polygon') {
                        let polyCoords=geometrySubObj['coordinates'];
                        uniquePropValues[uniquePropValue].push(polyCoords);
                    } else if(geometrySubType=='MultiPolygon') {
                        let multiPolyCoords=geometrySubObj['coordinates'];
                        for(let m1 in multiPolyCoords) {
                            for(let m2 in multiPolyCoords[m1]) {
                                let polyCoords=[multiPolyCoords[m1][m2]];
                                uniquePropValues[uniquePropValue].push(polyCoords);
                            }
                        }
                    } else {
                    	let geojsonSubInputFeature={
                    		'type':'Feature',
                    		'properties':featurePropsCopy,
                    		'geometry': geometrySubObj
                    	};
                    	nonPolyFeaturesArr.push(geojsonSubInputFeature);
                    }
                }
            } else {
            	nonPolyFeaturesArr.push(geojsonInputFeature);
            }
            uniquePropObjs[uniquePropValue]=featureProps;
        } // end for-loop
        let geojsonOutput= {
            'type': 'FeatureCollection', 
            'features': []
        };
        for(let uKey in uniquePropValues) {
            let uniquePropObj=uniquePropObjs[uKey];
            let uniquePropValueCoords=uniquePropValues[uKey];   
            let subPolyArr=[];
            for(let uIndex in uniquePropValueCoords) {
                let subPolyCoords=uniquePropValueCoords[uIndex];
                if(typeof subPolyCoords !== 'undefined') {
                    let poly=turf.polygon(subPolyCoords, uniquePropObj);
                    subPolyArr.push(poly);
                }
            }
            let prevPoly=null;
            for(let uIndex in subPolyArr) {
                if(prevPoly==null) {
                    prevPoly=subPolyArr[uIndex];
                } 
                if(typeof subPolyArr[uIndex] !== 'undefined') {
                    prevPoly = turf.union(prevPoly, subPolyArr[uIndex]);
                }
            }
            prevPoly['properties']=featurePropsCopy;
            geojsonOutput['features'].push(prevPoly);
        }
        geojsonOutput['features']=geojsonOutput['features'].concat(nonPolyFeaturesArr);
        return geojsonOutput;
	}

	outputSpatialFormatBtn.addEventListener('click', async()=> {
		let updatedGeojsonObj={
			'type':'FeatureCollection',
			'features': []
		};
		// [StART] combine geojson objects of mapLayer and pointLayer
		let geojsonObjFeatures=mapGeojsonObj['features'].concat(pointGeojsonObj['features']);
		for(let geojsonObjFeature of geojsonObjFeatures) {
			let propertiesObj=geojsonObjFeature['properties'];
			let geometryObj=geojsonObjFeature['geometry'];
			// [START] Delete selected properties
			for(let k in toDel) {
				let delProp=toDel[k];
				if(delProp==true) {
					delete propertiesObj[k];
				}
			}
			// [END] Deleted selected props
			let updatedGeojsonFeature={
				'type': 'Feature',
				'geometry': JSON.parse(JSON.stringify(geometryObj)),
				'properties': JSON.parse(JSON.stringify(propertiesObj))
			};
			updatedGeojsonObj['features'].push(updatedGeojsonFeature);
		}
		let updatedGeoData=JSON.stringify(updatedGeojsonObj);
		// [END] combined geojson objects of mapLayer and pointLayer with deleted props

		let outputFileExt='.geojson';
		let fileData;
		let outputFormatVal=outputSpatialFormat.value;
	  	if(outputFormatVal=='GEOJSON') {
			outputFileExt='.geojson';
		} else if(outputFormatVal=='KML') {
			outputFileExt='.kml';
			updatedGeoData=tokml(updatedGeojsonObj);
		} else if(outputFormatVal=='SHP') {
			outputFileExt='.zip';
			fileData = await shpwrite.zip(updatedGeojsonObj);
			fileData=`data:application/zip;base64,${fileData}`;
		}

		let dwnlnk = document.createElement('a');
        dwnlnk.download = outputSpatialFormatBtn.value + outputFileExt;

        if(outputFormatVal=='GEOJSON' || outputFormatVal=='KML') {
        	let fileBlob = new Blob([updatedGeoData], {
	            type: 'text/plain'
	        });
        	fileData=window.URL.createObjectURL(fileBlob);
        }
		
        dwnlnk.href = fileData;
        dwnlnk.click();
	});

    async function renderPropsTable(geojsonObj) {
    	// console.log([mapPropsDatatableContainer,mapPropsDatatable]);
    	if(typeof mapPropsDatatable !== 'undefined') {
			mapPropsDatatableContainer.removeChild(mapPropsDatatable);
		}
    	let allPropObjs=[];
    	// initialise all props upon upload for deletion (if any)
		let geojsonObjFeatures=geojsonObj['features'];
		for(let u in geojsonObjFeatures) {
			let geojsonObjFeature=geojsonObjFeatures[u];
			let geojsonObjFeatureProps=geojsonObjFeature['properties'];

			toDel = JSON.parse(JSON.stringify(geojsonObjFeatureProps));
			for(let propKey in toDel) {
				toDel[propKey] = false;					
			}
			allPropObjs.push(geojsonObjFeatureProps);
		}

		// render table of all props
		mapPropsDatatable = document.createElement('table');
    	mapPropsDatatable.id='mapPropsDatatable';
    	mapPropsDatatable.setAttribute('class','table table-bordered table-condensed table-sm m-0');
    	mapPropsDatatableContainer.appendChild(mapPropsDatatable);

    	const csvDataOutput = await converter.json2csvAsync(allPropObjs, json2tableOptions);
    	let csvDataOutputHtmlStr = `<tr><td>${csvDataOutput}</td></tr>`;

    	let trHtmlStrArr=csvDataOutputHtmlStr.split('<tr>');
    	trHtmlStrArr.shift(); // empty string
    	let theadRowHtmlStr=trHtmlStrArr.shift();
    	theadRowHtmlStr=`<thead><tr>${theadRowHtmlStr}</thead>`;
    	theadRowHtmlStr=theadRowHtmlStr.replaceAll('<td>','<th>');
    	theadRowHtmlStr=theadRowHtmlStr.replaceAll('</td>','</th>');
    	const theadRowHtmlEle=htmlToElement(theadRowHtmlStr);
    	mapPropsDatatable.appendChild(theadRowHtmlEle);

    	let tbodyRowHtmlStr=`<tbody><tr>${trHtmlStrArr.join('<tr>')}</tbody>`;
    	const tbodyRowHtmlEle=htmlToElement(tbodyRowHtmlStr);
    	mapPropsDatatable.appendChild(tbodyRowHtmlEle);

    	try {
        	let headerRow=mapPropsDatatable.rows[0];
			let headerCols=headerRow.querySelectorAll('th');
			for(let headerCol of headerCols) {
				let colField = headerCol.innerText;
				let hrEle = document.createElement('hr');
				hrEle.className='mt-1 mb-1';
				headerCol.prepend(hrEle);

				let delBtn = document.createElement('button');
				delBtn.value = colField;
				delBtn.type = 'button';
				delBtn.innerText = nilField; 
				delBtn.className = 'ml-1 mr-1 p-0 symbol rounded-circle btn btn-sm btn-outline-danger delBtn';
				delBtn.style.height='24px';
				delBtn.style.width='24px';
				toDel[colField]=false;
				headerCol.prepend(delBtn);

				let mergeBtn = document.createElement('button');
				mergeBtn.value = colField;
				mergeBtn.type = 'button';
				mergeBtn.innerText = mergeField;
				mergeBtn.className = 'ml-1 mr-1 p-0 symbol rounded-circle btn btn-sm btn-info mergeBtn';
				mergeBtn.style.height='24px';
				mergeBtn.style.width='24px';
				headerCol.prepend(mergeBtn);
			}
        } catch(err) {
        	alert('ERROR: ' + err.message);
        }
	  	return Promise.resolve(geojsonObj);
    }

    async function renderGeojsonLayer(geojsonObj) {
    	let geojsonObjFeatureArr=geojsonObj['features'];
    	mapGeojsonObj={
			'type':'FeatureCollection',
			'features': []
    	};
		pointGeojsonObj={
			'type':'FeatureCollection',
			'features': []
    	};
    	for(let geojsonInputFeature of geojsonObjFeatureArr) {
    		let featureProps=geojsonInputFeature['properties'];
			let featureGeometry=geojsonInputFeature['geometry'];
			let featureGeometryType=featureGeometry['type'];

    		if(featureGeometryType=='GeometryCollection') {
		      	let geometriesArr=featureGeometry['geometries'];
		      	for(let g2 in geometriesArr) {
		          	let geometrySubObj=geometriesArr[g2];
		          	let geometrySubCoords=geometrySubObj['coordinates'];
		          	let geometrySubType=geometrySubObj['type'];

		          	let subPropsObj=JSON.parse(JSON.stringify(featureProps));
		          	// subPropsObj["geometryType"]=geometrySubType;
		          	let subFeature={
		          	'type':"Feature",
		          	'properties':subPropsObj,
	                  	'geometry':{
		                    'type':geometrySubType,
		                    'coordinates':geometrySubCoords
	                  	}
		          	};
		         	if(geometrySubType!=='Point' && geometrySubType!='MultiPoint') {
		              	mapGeojsonObj['features'].push(subFeature);
		          	} else {
		          		pointGeojsonObj['features'].push(subFeature);
		           	}
		      	} // end for-loop
		  	} else if(featureGeometryType!=='Point' && featureGeometryType!='MultiPoint') {
		  		// geojsonInputFeature['properties']['geometryType']=featureGeometryType;
    			mapGeojsonObj['features'].push(geojsonInputFeature);
    	  	} else {
    	  		// geojsonInputFeature['properties']['geometryType']=featureGeometryType;
    			pointGeojsonObj['features'].push(geojsonInputFeature);
    	  	}
    	}
		

		if(mapGeojsonObj['features'].length === 0) {
			mapLayer=undefined;
		} else {
			mapLayer = L.geoJSON(mapGeojsonObj, {
			    style: function (feature) {
			        return {
			        	color: '#616366', // rgb(97 99 102) // #dc3b3b | rgb(220 59 59)
			        	weight: 1.75,
			        	className: 'input-feature'
			        }
			    }
			})
			.bindPopup((layer)=>jsonObjToHTMLTable(layer.feature.properties))
			.addTo(map);		
		}
		if(pointGeojsonObj['features'].length === 0) {
			pointLayer=undefined;
		} else {
			pointLayer = L.geoJSON(pointGeojsonObj, {
			    pointToLayer: function (feature, latlng) {
			        let marker=L.marker(latlng, {
			        	icon: markerIcon
			        }).bindPopup(jsonObjToHTMLTable(feature.properties));
			        return marker;
			    }
			}).addTo(map);

			// console.log(pointLayer);
		}
		let promise = new Promise((resolve, reject) => {
		    setTimeout(() => resolve('renderGeojsonLayer'), 100)
		});
		return promise;
	}

    inputSpatialFormatBtn.addEventListener('change', async(uploadFle) => {
		let fileis = inputSpatialFormatBtn.files[0];
        let fileName = uploadFle.target.value;
        fileName = fileName.split("\\")[2];
        let n = fileName.lastIndexOf(".");
        fileName = fileName.substring(0,n);

        let geojsonObj = null;
		uploadedGeojsonObj=null;
		// check which spatial format is selected
		let spatialType=inputSpatialFormatDDL.value;
        outputSpatialFormatBtn.value = fileName;
        let fileredr = new FileReader();
    	if(spatialType=='SHP') {
    		fileredr.readAsArrayBuffer(fileis);
    	} else if(spatialType=='KML' || spatialType=='GEOJSON') {
        	fileredr.readAsText(fileis);
        }
        fileredr.addEventListener('load', async(fle) => {
        	let filecont = fle.target.result; // array buffer
           	uploadSpatialFileIs=filecont;
            if(spatialType=='SHP') {
            	geojsonObj = await shp(uploadSpatialFileIs);
            } else if(spatialType=='KML') {
            	geojsonObj=await KMLStrtoGeoJSON(uploadSpatialFileIs);
            } else if(spatialType=='GEOJSON') {
            	try {
            		geojsonObj=JSON.parse(uploadSpatialFileIs);
            	} catch(err) {
            		alert('ERROR: ' + err.message);
            	}
            }

            if(geojsonObj !== null) {
				uploadedGeojsonObj=await renderPropsTable(geojsonObj); 
				highlightJSON('geojsonDisplayContainer', uploadedGeojsonObj);
				let res=await renderGeojsonLayer(uploadedGeojsonObj);
				console.log(res);

				res=await bindDelBtnPropEvent();
				console.log(res);

				res=await bindMergeBtnPropEvent();
				console.log(res);

				scale.addTo(map);
				zoomControl.addTo(map);
				attributionControl.addTo(map);

				resetMapView();
			}
            inputSpatialFormatDDL.disabled=true;
			inputSpatialFormatBtn.disabled=true;

			outputSpatialFormatDDL.disabled=false;
			outputSpatialFormatBtn.disabled=false;

			resetMapViewBtn.disabled=false;
       }); // end file-reader onload
	}); // inputSpatialFormatBtn function

	
	function resetMapView() {
		// console.log([mapLayer,pointGeojsonObj]);
		if(typeof mapLayer !== 'undefined') {
			let layerBounds=mapLayer.getBounds();
			map.fitBounds(layerBounds);
		} else {
			const center = turf.center(pointGeojsonObj);
			// console.log(center);
			// var center = turf.point([103.83254, 1.28454]);
			let radius = 5;
			let bearing1 = 25;
			let bearing2 = 45;

			let sector = turf.sector(center, radius, bearing1, bearing2);
			// console.log(sector);
			let sectorLayer=L.geoJSON(sector);
			// console.log(sector);
			map.fitBounds(sectorLayer.getBounds());
		}
	}
	resetMapViewBtn.addEventListener('click', () => {	
		resetMapView();
	});

	function bindDelBtnPropEvent() {
		let delBtns=document.querySelectorAll('.delBtn');
		for(let delBtn of delBtns) {
			delBtn.addEventListener('click', (e)=> {
				let noDel=(e.target.innerText === nilField);
				let colField=e.target.value;

				delBtn.innerText = noDel ? delField : nilField;
				if(noDel) {
					delBtn.classList.add('btn-danger');
					delBtn.classList.remove('btn-outline-danger');
				} else {
					delBtn.classList.add('btn-outline-danger');
					delBtn.classList.remove('btn-danger');
				}

				let toDelVal = toDel[colField];
				toDel[colField]=!toDelVal;
			});
		}
		let promise = new Promise((resolve, reject) => {
		    setTimeout(() => resolve('bindDelBtnPropEvent'), 100)
		});
		return promise;
	}

	function bindMergeBtnPropEvent() {
		let mergeBtns=document.querySelectorAll('.mergeBtn');
		for(let mergeBtn of mergeBtns) {
			mergeBtn.addEventListener('click', async(e)=> {
				let propToMerge=e.target.value;
				let geojsonObj=unionPolygons(uploadedGeojsonObj, propToMerge);

				map.removeControl(scale);
				map.removeControl(zoomControl);
				map.removeControl(attributionControl);

				if(typeof mapLayer !== 'undefined') {
					map.removeLayer(mapLayer);
				}
				if(typeof pointLayer !== 'undefined') {
					map.removeLayer(pointLayer);
				}

				map.eachLayer(function(layer) {
					map.removeLayer(layer);
				});

				mapLayer=undefined;
				pointLayer=undefined;

				imgBounds=null;
				layerBounds=null;
				
				// imgBounds_Left.innerHTML='';
				// imgBounds_Right.innerHTML='';
				// imgBounds_Bottom.innerHTML='';
				// imgBounds_Top.innerHTML='';
				renderFillerTable();

				uploadedGeojsonObj=await renderPropsTable(geojsonObj); 
				highlightJSON('geojsonDisplayContainer', uploadedGeojsonObj);

				let res=await renderGeojsonLayer(uploadedGeojsonObj);
				console.log(res);

				res=await bindDelBtnPropEvent();
				console.log(res);

				res=await bindMergeBtnPropEvent();
				console.log(res);

				scale.addTo(map);
				zoomControl.addTo(map);
				attributionControl.addTo(map);

				resetMapView();
			});
		}
		let promise = new Promise((resolve, reject) => {
		    setTimeout(() => resolve('bindMergeBtnPropEvent'), 100)
		});
		return promise;
	}

	clearAllBtn.addEventListener('click', () => {
		inputSpatialFormatDDL.disabled=false;
		inputSpatialFormatBtn.disabled=false;

		outputSpatialFormatDDL.disabled=true;
		outputSpatialFormatBtn.disabled=true;

		resetMapViewBtn.disabled=true;

		uploadSpatialFileIs=null;
		spatialType='GEOJSON';

		map.removeControl(scale);
		map.removeControl(zoomControl);
		map.removeControl(attributionControl);

		if(typeof mapLayer !== 'undefined') {
			map.removeLayer(mapLayer);
		}
		if(typeof pointLayer !== 'undefined') {
			map.removeLayer(pointLayer);
		}

		map.eachLayer(function(layer) {
			map.removeLayer(layer);
		});

		mapLayer=undefined;
		pointLayer=undefined;

		imgBounds=null;
		layerBounds=null;

		inputSpatialFormatDDL.value='GEOJSON';
		outputSpatialFormatDDL.value='GEOJSON';
		inputSpatialFormatBtn.value='';
		outputSpatialFormatBtn.value='';

		imgBounds_Left.innerHTML='';
		imgBounds_Right.innerHTML='';
		imgBounds_Bottom.innerHTML='';
		imgBounds_Top.innerHTML='';

		renderFillerTable();
		triggerEvent(inputSpatialFormatDDL,'change');
	});

	renderFillerTable();
	triggerEvent(clearAllBtn,'click');
});