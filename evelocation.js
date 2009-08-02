const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function location() { }

location.prototype = {
    classDescription:   "EVE Location",
    classID:            Components.ID("{e479ec0f-0781-4ae6-abb6-0cc2bb67038b}"),
    contractID:         "@aragaer/eve/location;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveLocation]),

    get type()      this._type,
    get id()        this._id,
    get name()      this._name,
};

var components = [location];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

