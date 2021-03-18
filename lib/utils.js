function is(className, object) {
  return (
    Object.prototype.toString.call(object) === "[object " + className + "]"
  );
}

const DataEncoder = function () {
  this.levels = [];
  this.actualKey = null;
};

DataEncoder.prototype.__dataEncoding = function (data) {
  const levelsSize = this.levels.length;
  let uriPart = "";
  let finalString = "";

  if (levelsSize) {
    uriPart = this.levels[0];
    for (let c = 1; c < levelsSize; c++) {
      uriPart += "[" + this.levels[c] + "]";
    }
  }

  if (is("Object", data)) {
    const keys = Object.keys(data);
    const l = keys.length;

    for (let a = 0; a < l; a++) {
      const key = keys[a];
      let value = data[key];
      this.actualKey = key;
      this.levels.push(this.actualKey);
      finalString += this.__dataEncoding(value);
    }
  } else if (is("Array", data)) {
    if (!this.actualKey) throw new Error("Directly passed array does not work");

    const aSize = data.length;

    for (let b = 0; b < aSize; b++) {
      let aVal = data[b];
      this.levels.push(b);
      finalString += this.__dataEncoding(aVal);
    }
  } else {
    finalString += uriPart + "=" + encodeURIComponent(data) + "&";
  }

  this.levels.pop();

  return finalString;
};

DataEncoder.prototype.convertToObject = function (search) {
  return JSON.parse(
    '{"' +
      decodeURI(search)
        .replace(/"/g, '\\"')
        .replace(/&/g, '","')
        .replace(/=/g, '":"') +
      '"}'
  );
};

DataEncoder.prototype.encode = function (data) {
  if (!is("Object", data) || data === {}) return null;
  return this.__dataEncoding(data).slice(0, -1);
};

export default DataEncoder;
