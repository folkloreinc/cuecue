import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';

export const parseInputId = (data) => {
    if (isArray(data)) {
        return data.map(({ id = null, ...item }) => ({
            ...item,
            ...(id !== null ? { externalId: id } : null),
        }));
    }

    if (isObject(data)) {
        const { id = null, ...props } = data;
        return { ...props, ...(id !== null ? { externalId: id } : null) };
    }
    return null;
};

export const parseOutputId = (data) => {
    if (isArray(data)) {
        return data.map(({ externalId = null, ...item }) => ({
            ...item,
            ...(externalId !== null ? { id: externalId } : null),
        }));
    }

    if (isObject(data)) {
        const { externalId = null, ...props } = data;
        return { ...props, ...(externalId !== null ? { id: externalId } : null) };
    }
    return null;
};
