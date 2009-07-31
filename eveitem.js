const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var EveDBService;

function eveitem(id, location, container, type, quantity, flag, singleton) {
    this._id = id;
    this._location = location;
    this._container = container;
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

    toString:           function () {
        return EveDBService.getItemNameByType(this._type);
    },
    locationString:     function () {
        return EveDBService.locationToString(this._location);
    },
    containerString:     function () {
        return this._container
            ? EveDBService.getItemNameByType(this._container)
            : '';
    },

    get id()        this._id,
    get location()  this._location,
    get container() this._container,
    get type()      this._type,
    get quantity()  this._quantity,
    get flag()      this._flag,
    get singleton() this._singleton,
};

function itembuilder() { }

itembuilder.prototype = {
    classDescription:   "EVE Item Builder",
    classID:            Components.ID("{e5dc59a4-217e-46da-8c9f-d6de36df2d3f}"),
    contractID:         "@aragaer/eve/item-builder;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemBuilder]),
    _xpcom_factory:     {
        createInstance:     function (outer, iid) {
            if (outer)
                throw Components.results.NS_ERROR_NO_AGGREGATION;
            if (!EveDBService)
                EveDBService = Cc["@aragaer/eve/db;1"].
                        getService(Ci.nsIEveDBService);
            return (new itembuilder()).QueryInterface(iid);
        },
    },
    _xpcom_categories:  [{
        category: "profile-do-change",
        service: true
    }],

/* Item Builder */
    createItem:     function (id, location, container, type, quantity, flag, singleton) {
        return new eveitem(id, location, container, type, quantity, flag, singleton);
    }
}

var components = [eveitem, itembuilder];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

