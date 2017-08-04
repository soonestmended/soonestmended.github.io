class Series {
  constructor(_w, _h, _d, _name, _images) {
    this.width = _w;
    this.height = _h;
    this.depth = _d;
    this.name = _name;
    this.images = _images;
    this.mask = null;
  }
}

class Study {
  constructor(argmap) {
    if (argmap.get('type') == 'nifti') {
      this.initFromNiftis(argmap);
    }
  }

  initFromNiftis(argmap) {
    var nHeaders = argmap.get('headers');  // array of headers from the nifti files
    var nImages = argmap.get('imageData'); // array of image data from the nifti files

    this.series = []; 

    var N = nHeaders.length;

    for (var i = 0; i < N; ++i) { // loop over nifti files
      var images = [];
      var header = nHeaders[i];
      var w = header.dims[1];
      var h = header.dims[2];
      var d = header.dims[3];
      for (var j = 0; j < d; j++) { // loop over image
        var sliceSize = w * h * (header.numBitsPerVoxel/8);
        images.push(new Int16Array(nImages[i].slice(j*sliceSize, (j+1)*sliceSize)));
      }
      this.series.push(new Series(w, h, d, header.description, images));
    }

  }

  addMaskFromNifti(seriesIndex, maskHeader, maskData) {
    // mask is an array of images with matching depth
    if (seriesIndex >= this.series.length) {
      console.log("Adding mask failed -- series " + seriesIndex + " doesn't exist.");
      return;
    } 
    var s = this.series[seriesIndex];
    var w = maskHeader.dims[1];
    var h = maskHeader.dims[2];
    var d = maskHeader.dims[3];
    if (s.width != w || s.height != h || s.depth != d) {
      console.log("Adding mask failed -- mask dimensions don't match series dimensions.");
      return;
    }
    this.mask = new Map();

    var images = [];
    for (var j = 0; j < d; j++) { // loop over image
      var sliceSize = w * h * (maskHeader.numBitsPerVoxel/8);
      images.push(new Int16Array(maskData.slice(j*sliceSize, (j+1)*sliceSize)));
    }
    this.mask.set(seriesIndex, new Series(w, h, d, maskHeader.description, images));
  }

  maskTo2DTextures() {
    var texArray = [];
    for (var i = 0; i < this.series.length; ++i) {
      if (!this.mask.has(i)) {
        texArray.push(null);
        continue;
      }
      var tex = [];
      var s = this.mask.get(i);
      for (let img of s.images) {
        var texData = twgl.primitives.createAugmentedTypedArray(4, s.width * s.height); // Default Float32 array
        if (img instanceof Int16Array) {
          for (var j = 0; j < s.width * s.height; j++) {
            // convert signed short to float
            var fv = img[j];
            texData.push([fv*.2, fv*.2, fv, fv*0.25]);
          }
        }
        tex.push(twgl.createTexture(gl, {
          min: gl.NEAREST,
          mag: gl.NEAREST,
          width: s.width,
          height: s.height,
          src: texData,
        }));
      }
      texArray.push(tex);
    }
    return texArray;
  }

  to2DTextures() {
    var texArray = [];
    for (let s of this.series) {
      var tex = [];
      for (let img of s.images) {
        var texData = twgl.primitives.createAugmentedTypedArray(4, s.width * s.height); // Default Float32 array
        if (img instanceof Int16Array) {
          for (var i = 0; i < s.width * s.height; i++) {
            // convert signed short to float
            var fv = (img[i] + 32768.) / 65536.;
            texData.push([fv, fv, fv, 1.0]);
          }
        }
        tex.push(twgl.createTexture(gl, {
          min: gl.NEAREST,
          mag: gl.NEAREST,
          width: s.width,
          height: s.height,
          src: texData,
        }));
      }
      texArray.push(tex);
    }
    return texArray;
  }

}