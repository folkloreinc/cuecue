import EventEmitter from 'wolfy87-eventemitter';
import { v4 as uuidv4 } from 'uuid';
import createDebug from 'debug';
import matches from 'lodash/matches';
import isObject from 'lodash/isObject';

class MemoryStore extends EventEmitter {
    constructor(data = {}) {
        super();

        this.data = data || {};

        this.debug = createDebug('cuecue:store:memory');
    }

    findItem(type, id) {
        const items = this.data[type] || [];
        return items.find(
            matches(
                isObject(id)
                    ? id
                    : {
                          id,
                      },
            ),
        );
    }

    addItem(type, data) {
        const id = data.id || uuidv4();
        const savedItem = {
            ...data,
            id,
        };
        this.data = {
            ...this.data,
            [type]: [...(this.data[type] || []).filter((it) => it.id !== id), savedItem],
        };
        return savedItem;
    }

    updateItem(type, id, data) {
        const index = (this.data[type] || []).findIndex((it) => it.id === id);

        if (index === -1) {
            return null;
        }

        const newData = {
            ...this.data[type][index],
            ...data,
        };

        this.data = {
            ...this.data,
            [type]: (this.data[type] || []).map((it) => (it.id === id ? newData : it)),
        };

        return newData;
    }

    deleteItem(type, id) {
        this.data = {
            ...this.data,
            [type]: (this.data[type] || []).filter((it) => it.id !== id),
        };
    }

    deleteItems(type, params = {}) {
        const match = matches(params);
        this.data = {
            ...this.data,
            [type]: (this.data[type] || []).filter((it) => !match(it)),
        };
    }

    getItems(type, params = {}) {
        const match = matches(params);
        return (this.data[type] || []).filter((it) => match(it));
    }
}

export default MemoryStore;
