import { SEARCH_QUERY_KEYS } from '../constants/search-keys.constants';

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

    if (SEARCH_QUERY_KEYS.includes(this.actualKey)) {
      // Через запятую, но закодированной строкой — иначе "&" или "=" внутри значения
      // разорвут пару при обратном разборе.
      finalString += uriPart + "=" + encodeURIComponent(data.join(",")) + "&";
    } else {
      const aSize = data.length;

      for (let b = 0; b < aSize; b++) {
        let aVal = data[b];
        this.levels.push(b);
        finalString += this.__dataEncoding(aVal);
      }
    }

  } else {
    finalString += uriPart + "=" + encodeURIComponent(data) + "&";
  }

  this.levels.pop();

  return finalString;
};

// Обратно из строки в объект: сначала разбор по "&" и "=", потом декодирование
// каждой части. Раньше строка декодировалась целиком через decodeURI, который не трогает
// зарезервированные символы (":", "/", "+", "&", "="…) — и значение с ними уходило на
// сервер с "%3A" внутри: JSON фильтров поиска ломался, а запрос "1+1" искался как "1%2B1".
DataEncoder.prototype.convertToObject = function (search) {
  const result = {};
  if (!search) return result;
  search.split("&").forEach((pair) => {
    if (!pair) return;
    const index = pair.indexOf("=");
    const key = index === -1 ? pair : pair.slice(0, index);
    const value = index === -1 ? "" : pair.slice(index + 1);
    result[decodeURIComponent(key)] = decodeURIComponent(value);
  });
  return result;
};

DataEncoder.prototype.encode = function (data) {
  if (!is("Object", data) || data === {}) return null;
  return this.__dataEncoding(data).slice(0, -1);
};

function is(className, object) {
  return (
    Object.prototype.toString.call(object) === "[object " + className + "]"
  );
}

export default DataEncoder;
