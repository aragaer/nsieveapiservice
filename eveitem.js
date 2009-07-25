const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function eveitem(id, location, type, quantity, flag, singleton) {
    this._id = id;
    this._location = location;
    this._type = type;
    this._quantity = quantity;
    this._flag = flag;
    this._singleton = singleton;
}

eveitem.prototype = {
    classDescription:   "EVE Item",
    classID:            Components.ID("{658ce840-ac50-4429-97bd-a68e9327b884}"),
    contractID:         "@aragaer/eve/item;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItem]),

    get id() { return this._id },
    get type() { return this._type },
};

function itembuilder() { }

itembuilder.prototype = {
    classDescription:   "EVE Item Builder",
    classID:            Components.ID("{e5dc59a4-217e-46da-8c9f-d6de36df2d3f}"),
    contractID:         "@aragaer/eve/item-builder;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemBuilder]),
    _xpcom_categories: [{
        category: "xpcom-startup",
        service: true
    }],

    createItem:     function (id, location, type, quantity, flag, singleton) {
        return new eveitem(id, location, type, quantity, flag, singleton);
    }
}

var components = [eveitem, itembuilder];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

