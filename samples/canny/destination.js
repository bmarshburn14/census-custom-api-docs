// helper for simple non-batched upsert destinations

const FIELD_DEFAULTS = {
    identifier: false,
    createable: true,
    updateable: true,
    required: false,
    array: false,
}

export const Destination = (destinationObjects) => {
    return {
        test_connection: () => {
            return { success: true };
        },
        list_objects: () => {
            const objects = Object.keys(destinationObjects).map(name => ({ 
                object_api_name: name, 
                label: destinationObjects[name].label,
                can_create_fields: destinationObjects[name].can_create_fields
            }));
            return { objects };
        },
        supported_operations: ({ object }) => {
            const operations = Object.keys(destinationObjects[object.object_api_name])
                                     .filter(k => k.endsWith('Handler'))
                                     .map(k => k.match(/(.*)Handler/)).map(r => r[1])
            return { operations };
        },
        list_fields: ({ object }) => {
            const fields = destinationObjects[object.object_api_name].fields.map(f => 
                Object.assign({}, FIELD_DEFAULTS, f)
            )
            return { fields };
        },
        get_sync_speed: () => {
            return {
                maximum_batch_size: 1000,
                maximum_records_per_second: 100,
                maximum_parallel_batches: 4,
            };
        },
        sync_batch: async ({ sync_plan, records }) => {
            const handlerName = `${sync_plan.operation}Handler`;
            const key_column = Object.values(sync_plan.schema).find(v => v.active_identifier).field.field_api_name;
            const record_results = await Promise.all(records.map(async (record) => {
                try {
                    const res = await destinationObjects[sync_plan.object.object_api_name][handlerName](record);
                    return {
                        identifier: record[key_column],
                        success: true,
                    };
                } catch (error) {
                    return {
                        identifier: record[key_column],
                        success: false,
                        error_message: error?.response?.data || error?.message,
                    };
                }
            }));
            return { record_results };
        }
    };
}