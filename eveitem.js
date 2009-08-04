const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var EveDBService;
var EveItemBuilder;
const PreloadedTypes = {};
const PreloadedGroups = {};
const PreloadedCategories = {};

function eveitemcategory(catid) {
    this._id = catid;
    this._name = EveDBService.getItemCategoryNameByID(catid);
}

eveitemcategory.prototype = {
    classDescription:   "EVE item category",
    classID:            Components.ID("{ef3555fb-be5d-43c9-83ab-d3e8d5432f43}"),
    contractID:         "@aragaer/eve/item-category;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemCategory]),

    get id()            this._id,
    get name()          this._name,
};

function eveitemgroup(groupid) {
    this._id = groupid;
    this._name = EveDBService.getItemGroupNameByID(groupid);
    this._category = EveItemBuilder.getItemCategoryByGroup(groupid);
}

eveitemgroup.prototype = {
    classDescription:   "EVE item group",
    classID:            Components.ID("{5e922507-10b0-4fee-b8df-9f95df29a28a}"),
    contractID:         "@aragaer/eve/item-group;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemGroup]),

    get id()            this._id,
    get name()          this._name,
    get category()      this._category,
};

function eveitemtype(typeid) {
    this._id = typeid;
    this._name = EveDBService.getItemTypeNameByID(typeid);
    this._group = EveItemBuilder.getItemGroupByType(typeid);
}

eveitemtype.prototype = {
    classDescription:   "EVE item type",
    classID:            Components.ID("{fb6bfcfe-5f16-4dc1-a78d-de5e4b766a26}"),
    contractID:         "@aragaer/eve/item-type;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItemType]),

    get id()            this._id,
    get name()          this._name,
    get group()         this._group,
};

function eveitem(id, location, container, type, quantity, flag, singleton) {
    this._id = id;
    this._location = location;
    this._container = container;
    this._type = EveItemBuilder.getItemType(type);
    this._quantity = quantity;
    this._flag = flag;
    this._singleton = singleton;
    this._childs = null;
}

eveitem.prototype = {
    classDescription:   "EVE Item",
    classID:            Components.ID("{658ce840-ac50-4429-97bd-a68e9327b884}"),
    contractID:         "@aragaer/eve/item;1",
    QueryInterface:     XPCOMUtils.generateQI([Ci.nsIEveItem]),

    toString:           function () {
        return this.type.name;
    },
    locationString:     function () {
        return EveDBService.locationToString(this._location);
    },
    containerString:    function () {
        return this._container
            ? this._container.toString()
            : '';
    },

    get id()        this._id,
    get location()  this._location,
    get container() this._container,
    get type()      this._type,
    get quantity()  this._quantity,
    get flag()      this._flag,
    get singleton() this._singleton,

    isContainer:        function () {
        return this._childs ? true : false;
    },

    getItemsInside:     function (out) {
        if (!this._childs)
            return null;
        var result = [i for each (i in this._childs)];
        out.value = result.length;
        return result;
    },

    addItem:            function (itm) {
        if (!this._childs)
            this._childs = [];
        if (!this._childs['itm' + itm.id])
            this._childs['itm' + itm.id] = itm;
    },

    removeItem:         function (itm) {
        this._childs.delete('itm' + itm.id);
    },
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

    _getPreloaded:      function (storage, constructor) {
        return function (id) {
            if (!storage['itm' + id])
                storage['itm' + id] = new constructor(id);
            return storage['itm' + id];
        }
    },

    getItemGroupByType: function (type) {
        return this.getItemGroup(EveDBService.getItemGroupByType(type));
    },

    getItemCategoryByGroup: function (group) {
        return this.getItemCategory(EveDBService.getItemCategoryByGroup(group));
    },

/* Item Builder */
    createItem:     function (id, location, container, typeID, quantity, flag, singleton) {
        return new eveitem(id, location, container, typeID,
                quantity, flag, singleton);
    }
};

itembuilder.prototype.getItemCategory = itembuilder.prototype._getPreloaded(PreloadedCategories, eveitemcategory);
itembuilder.prototype.getItemGroup = itembuilder.prototype._getPreloaded(PreloadedGroups, eveitemgroup);
itembuilder.prototype.getItemType = itembuilder.prototype._getPreloaded(PreloadedTypes, eveitemtype);

EveItemBuilder = itembuilder.prototype;

var components = [eveitemcategory, eveitemgroup, eveitemtype, eveitem, itembuilder];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

