document.addEventListener("DOMContentLoaded", () => {
	/*
	GeoJSON Specs: https://datatracker.ietf.org/doc/html/rfc7946/
	ArcGIS: https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-GeoJSONLayer.html
	https://gis.stackexchange.com/questions/38863/how-to-render-a-table-with-mixed-geometry-types-in-qgis
	*/
	if (!window.FileReader) {
          alert("Your browser does not support HTML5 'FileReader' function required to open a file.");
          return;
    }
    if (!window.Blob) {
        alert("Your browser does not support HTML5 'Blob' function required to save a file.");
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
	const map = L.map('map', {
		zoomControl: false
	});
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

	function htmlToElement(html) {
	    let documentFragment = document.createDocumentFragment();
	    let template = document.createElement('template');
	    template.innerHTML = html.trim();
	    for (let i = 0, e = template.content.childNodes.length; i < e; i++) {
	        documentFragment.appendChild(template.content.childNodes[i].cloneNode(true));
	    }
	    return documentFragment;
	}

	const mapContainer=document.getElementById('map');

	const resetMapViewBtn=document.getElementById('resetMapViewBtn');
	const clearAllBtn=document.getElementById('clearAllBtn');

	const inputSpatialFormatDDL = document.getElementById('inputSpatialFormat');
	const inputSpatialFormatBtn = document.getElementById('inputSpatialFormatBtn');

	const outputSpatialFormatDDL=document.getElementById("outputSpatialFormat");
	const outputSpatialFormatBtn=document.getElementById("outputSpatialFormatBtn");

	const mapPropsDatatableContainer=document.getElementById('mapPropsDatatableContainer');

	const delField = '❌';
	const noDelField = '';

	// inputSpatialFormatBtn.addEventListener('mouseover', (evt)=> {
	// 	evt.currentTarget.labels[0].style.background='#e9ecef';
	// });
	// inputSpatialFormatBtn.addEventListener('mouseout', (evt)=> {
	// 	evt.currentTarget.labels[0].style.background='#ffffff';
	// });

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

	let toDel = {};

	let layerBounds;
	let mapLayer, pointLayer;

	const scale = L.control.scale({
      maxWidth: 100,
      metric: true,
      imperial: true,
      position: 'bottomleft'
    }).addTo(map);

	const zoomControl=L.control.zoom({ 
		position: 'topleft' 
	}).addTo(map);
	
	
	// const mb = L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Original_HD/{z}/{x}/{y}.png', {
 //      detectRetina: true,
 //      maxZoom: 19,
 //      minZoom: 11,
 //      attributions: false,
 //      zoomControl: false
 //    }).addTo(map);

	L.control.attribution({
      prefix: '<span class="prefix-attribution pr-1 pl-1"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAAXNSR0IArs4c6QAAAXZJREFUKFNjZMABZp5JYxVm+az2+z/DpkjD5cowZYzY1IMUi/P+7Pzz+3cMJze76LMHH2VTHdc9AanF0DDjYLCqjBzfLCYmJoffv34zsLAyM7x/+a0rxnxlOYaGpaejlLgF2FaxszMb//r5m+HL528MQiL8DN++/L4arLVIB0PDxlvx69g4WAJBEm9evWfg4eVi4OBkZ/j7l+Gqj+JcVA2zDgb5ySoIboQ58trFuwxa+nC/XvWUQ9Ow8XbCFTZ2Zm2Q6dcv3mXQ0FNiYGSEePHv739XfZTno9qw/VHyFQYGBu3PH78yPH/8mkFNRwEegF8+/DwYqrfEAcUPMA33bz1hEBEXZODl54ZrePHgc2Ci3aoNKBo230s88OvnL/t7Nx8zqOsoMrCysUCc8/f/Bx/FeYIYETf3cLg+A8P3+p+/fgUqqkpDFP/59/Pzh19ZkUZL52GN6YJ+AwETO/V6QWHuvF8//rz9/u13Jgv7n81h2qt/wTQAAJeGjg3D55B1AAAAAElFTkSuQmCC" /><a href="https://leafletjs.com/" title="A JavaScript library for interactive maps" target="_blank">Powered by Leaflet</a> | <span class="symbol">© Created by</span> <a href="https://medium.com/@geek-cc" target="_blank"> ξ(</span><span class="emoji">🎀</span><span class="symbol">˶❛◡❛) ᵀᴴᴱ ᴿᴵᴮᴮᴼᴺ ᴳᴵᴿᴸ</span></a></span>',
      position: 'bottomright'
    }).addTo(map);

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

	// Binding multiple events to a single element
	function addMultipleEvents(eventsArray, targetElem, handler) {
		eventsArray.map((event) => targetElem.on(event, handler));
	}

	outputSpatialFormatBtn.addEventListener('click', async()=> {
		let updatedGeojsonObj={
			'type':'FeatureCollection',
			'features': []
		};
		let geojsonObjFeatures=mapGeojsonObj['features'].concat(pointGeojsonObj['features']);
		for(let geojsonObjFeature of geojsonObjFeatures) {
			let propertiesObj=geojsonObjFeature['properties'];
			let geometryObj=geojsonObjFeature['geometry'];
			for(let k in toDel) {
				let delProp=toDel[k];
				if(delProp==true) {
					delete propertiesObj[k];
				}
			}
			let updatedGeojsonFeature={
				'type': 'Feature',
				'geometry': JSON.parse(JSON.stringify(geometryObj)),
				'properties': JSON.parse(JSON.stringify(propertiesObj))
			};
			updatedGeojsonObj['features'].push(updatedGeojsonFeature);
		}

		let updatedGeoData=JSON.stringify(updatedGeojsonObj);
		let outputFileExt='.geojson';

		let outputFormatVal=outputSpatialFormat.value;
	  	if(outputFormatVal=="GEOJSON") {
			outputFileExt='.geojson';
		} else if(outputFormatVal=="KML") {
			outputFileExt='.kml';
			updatedGeoData=tokml(updatedGeojsonObj);
		}
		
		let textblob = new Blob([updatedGeoData], {
            type: "text/plain"
        });
        let dwnlnk = document.createElement("a");
        dwnlnk.download = outputSpatialFormatBtn.value + outputFileExt;
        dwnlnk.href = window.URL.createObjectURL(textblob);
        dwnlnk.click();
	});

	function renderImageBounds() {
		imgBounds=map.getBounds();
		imgBounds_Left.innerHTML=imgBounds._southWest.lng;
		imgBounds_Right.innerHTML=imgBounds._northEast.lng;

		imgBounds_Bottom.innerHTML=imgBounds._southWest.lat;
		imgBounds_Top.innerHTML=imgBounds._northEast.lat;
	}

	inputSpatialFormatBtn.addEventListener('click', (e) => {
		e.target.value = '';
	});
	addMultipleEvents(['zoomend', 'dragend', 'viewreset', 'moveend', 'load', 'resize'], map, renderImageBounds);

	function renderGeojsonLayer(geojson) {
		let allPropObjs=[];
		uploadedGeojsonObj = geojson;

		let mapPropsDatatableHtmlStr='';
		let headerToAppend='';
		let uploadedGeojsonObjFeatures=uploadedGeojsonObj['features'];
		for(let u in uploadedGeojsonObjFeatures) {
			let uploadedGeojsonObjFeature=uploadedGeojsonObjFeatures[u];
			let uploadedGeojsonObjFeatureProps=uploadedGeojsonObjFeature['properties'];

			toDel = JSON.parse(JSON.stringify(uploadedGeojsonObjFeatureProps));
			for(let propKey in toDel) {
				toDel[propKey] = false;					
			}
			allPropObjs.push(uploadedGeojsonObjFeatureProps);
		}

		const json2csvOptions = {
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
        (async()=> {
        	mapPropsDatatable = document.createElement('table');
        	mapPropsDatatable.id='mapPropsDatatable';
        	mapPropsDatatable.setAttribute('class','table table-bordered table-condensed table-sm m-0');
        	mapPropsDatatableContainer.appendChild(mapPropsDatatable);

        	const csvDataOutput = await converter.json2csvAsync(allPropObjs, json2csvOptions);
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
					let delBtn = document.createElement('button');
					let colField = headerCol.innerText;
					delBtn.value = colField;
					delBtn.type = 'button';
					delBtn.innerText = noDelField; 
					delBtn.className = 'p-0 mb-2 symbol btn btn-sm rounded-circle btn-outline-danger';
					delBtn.style.height = '25px';
					delBtn.style.width = '25px';
					delBtn.style.display = 'block';
					toDel[colField]=false;
					headerCol.prepend(delBtn);

					delBtn.addEventListener('click', async(e)=> {
						let noDel=(e.target.innerText === noDelField);
						delBtn.innerText = noDel ? delField : noDelField;
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
	        } catch(err) {
	        	alert('ERROR: ' + err.message);
	        }
        })();

    	let uploadedGeojsonObjFeatureArr=uploadedGeojsonObj['features'];
    	mapGeojsonObj={
			'type':'FeatureCollection',
			'features': []
    	};
		pointGeojsonObj={
			'type':'FeatureCollection',
			'features': []
    	};
    	for(let geojsonInputFeature of uploadedGeojsonObjFeatureArr) {
    		let featureProps=geojsonInputFeature["properties"];
			let featureGeometry=geojsonInputFeature["geometry"];
			let featureGeometryType=featureGeometry["type"];

    		if(featureGeometryType=="GeometryCollection") {
		      	let geometriesArr=featureGeometry["geometries"];
		      	for(let g2 in geometriesArr) {
		          	let geometrySubObj=geometriesArr[g2];
		          	let geometrySubCoords=geometrySubObj["coordinates"];
		          	let geometrySubType=geometrySubObj["type"];

		          	let subPropsObj=JSON.parse(JSON.stringify(featureProps));
		          	subPropsObj["geometryType"]=geometrySubType;

		          	let subFeature={
		          	"type":"Feature",
		          	"properties":subPropsObj,
	                  	"geometry":{
		                    "type":geometrySubType,
		                    "coordinates":geometrySubCoords
	                  	}
		          	};
		         	if(geometrySubType!=='Point' && geometrySubType!='MultiPoint') {
		              	mapGeojsonObj['features'].push(subFeature);
		          	} else {
		          		pointGeojsonObj['features'].push(subFeature);
		           	}
		      	} // end for-loop
		  	} else if(featureGeometryType!=='Point' && featureGeometryType!='MultiPoint') {
		  		geojsonInputFeature['properties']['geometryType']=featureGeometryType;
    			mapGeojsonObj['features'].push(geojsonInputFeature);
    	  	} else {
    	  		geojsonInputFeature['properties']['geometryType']=featureGeometryType;
    			pointGeojsonObj['features'].push(geojsonInputFeature);
    	  	}
    	}
		let customIcon = L.Icon.extend({
		    options: {
		      iconSize:     [24, 24], // size of the icon
		      iconAnchor:   [24, 12], // point of the icon which will correspond to marker's location
		      popupAnchor:  [-6, -12] // point from which the popup should open relative to the iconAnchor
		    }
		});
		let markerIcon = new customIcon({
			iconUrl: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gU3ZnIFZlY3RvciBJY29ucyA6IGh0dHA6Ly93d3cub25saW5ld2ViZm9udHMuY29tL2ljb24gLS0+DQo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPg0KPHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMjU2IDI1NiIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+DQo8bWV0YWRhdGE+IFN2ZyBWZWN0b3IgSWNvbnMgOiBodHRwOi8vd3d3Lm9ubGluZXdlYmZvbnRzLmNvbS9pY29uIDwvbWV0YWRhdGE+DQo8Zz48Zz48Zz48cGF0aCBmaWxsPSJyZ2IoMjIwIDU5IDU5KSIgZD0iTTEyOCwxMGMtNDguOSwwLTg4LjUsMzkuNi04OC41LDg4LjVDMzkuNSwxNDcuNCwxMjgsMjQ2LDEyOCwyNDZzODguNS05OC42LDg4LjUtMTQ3LjVDMjE2LjUsNDkuNiwxNzYuOSwxMCwxMjgsMTB6IE0xMjgsMTU3LjVjLTMyLjYsMC01OS0yNi40LTU5LTU5YzAtMzIuNiwyNi40LTU5LDU5LTU5YzMyLjYsMCw1OSwyNi40LDU5LDU5QzE4NywxMzEuMSwxNjAuNiwxNTcuNSwxMjgsMTU3LjV6Ii8+PC9nPjwvZz48L2c+DQo8L3N2Zz4=',
			className: 'input-feature rounded-circle'
		});
		// console.log(mapGeojsonObj);
		// console.log(pointGeojsonObj);
		mapLayer = L.geoJSON(mapGeojsonObj, {
		    style: function (feature) {
		        return {
		        	fillColor: '#F8F9FA',
		        	color: '#616366', // rgb(97 99 102)
		        	weight: 1.75,
		        	opacity: 1.0,
		        	fillOpacity: 0.65,
		        	className: 'input-feature'
		        }
		    }
		})
		.bindPopup((layer)=>jsonObjToHTMLTable(layer.feature.properties))
		.addTo(map);
		
		pointLayer = L.geoJSON(pointGeojsonObj, {
		    pointToLayer: function (feature, latlng) {
		        let marker=L.marker(latlng, {
		        	icon: markerIcon
		        }).bindPopup(jsonObjToHTMLTable(feature.properties));
		        return marker;
		    }
		}).addTo(map);
		map.fitBounds(mapLayer.getBounds());
		resetMapView();
	}
	function resetMapView() {
		let layerBounds=mapLayer.getBounds();
		map.fitBounds(layerBounds);
	}
	inputSpatialFormatBtn.addEventListener('change', async(uploadFle) => {
		let fileis = inputSpatialFormatBtn.files[0];
        let fileName = uploadFle.target.value;
        fileName = fileName.split("\\")[2];
        let n = fileName.lastIndexOf(".");
        fileName = fileName.substring(0,n);

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
            	let geojsonObj = await shp(uploadSpatialFileIs);
				renderGeojsonLayer(geojsonObj);
            } else if(spatialType=='KML') {
            	let geojsonObj=await KMLStrtoGeoJSON(uploadSpatialFileIs);
            	renderGeojsonLayer(geojsonObj);
            } else if(spatialType=='GEOJSON') {
            	let geojsonObj=null;
            	try {
            		geojsonObj=JSON.parse(uploadSpatialFileIs);
            	} catch(err) {
            		if(err.message.indexOf('SyntaxError: Unexpected token') < 0) {
            			geojsonObj=null;
            		}
            	}
            	if(geojsonObj !== null) {
					renderGeojsonLayer(geojsonObj);		            	
            	}
            }
            inputSpatialFormatDDL.disabled=true;
			inputSpatialFormatBtn.disabled=true;

			outputSpatialFormatDDL.disabled=false;
			outputSpatialFormatBtn.disabled=false;

			resetMapViewBtn.disabled=false;
       }); // end file-reader onload
	}); // inputSpatialFormatBtn function


	resetMapViewBtn.addEventListener("click", () => {	
		resetMapView();
	});

	clearAllBtn.addEventListener("click", () => {
		inputSpatialFormatDDL.disabled=false;
		inputSpatialFormatBtn.disabled=false;

		outputSpatialFormatDDL.disabled=true;
		outputSpatialFormatBtn.disabled=true;

		resetMapViewBtn.disabled=true;

		uploadSpatialFileIs=null;
		spatialType='GEOJSON';

		map.removeLayer(mapLayer);
		map.removeLayer(pointLayer);
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

		mapPropsDatatableContainer.removeChild(mapPropsDatatable);
		triggerEvent(inputSpatialFormatDDL,'change');
	});
});