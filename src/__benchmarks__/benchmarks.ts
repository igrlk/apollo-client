import Benchmark from "benchmark";
import gql from "graphql-tag";
import { writeQueryToStore } from "../cache/inmemory/__tests__/helpers";
import { cloneDeep } from "../utilities";
import { InMemoryCache } from "../cache";
import { StoreWriter } from "../cache/inmemory/writeToStore";
import { DocumentNode } from "graphql";

const writer = new StoreWriter(
	new InMemoryCache({
		dataIdFromObject(object: any) {
			if (object.__typename && object.id) {
				return object.__typename + '__' + object.id;
			}

			return false;
		},
	}),
);

interface BenchmarkMaterial {
	query: DocumentNode;
	result: Record<string, any>;
}

const threeNestedArraysQuery = gql`
    {
        id
        stringField
        numberField
        nullField
        nestedArray1 {
            id
            nestedArray1string
            nestedArray1number
            nestedArray1null
            nestedArray2 {
                id
                nestedArray2string
                nestedArray2number
                nestedArray2null
                nestedArray3 {
                    id
                    nestedObj3string
                    nestedObj3number
                    nestedObj3null
                }
            }
        }
    }
`

const get3NestedArraysResult = (n: number) => ({
	__typename: 'result',
	id: 'abcd',
	stringField: 'This is a string!',
	numberField: 5,
	nullField: null,
	nestedArray1: [{
		__typename: 'nested1',
		id: '1',
		nestedArray1string: 'This is a string too!',
		nestedArray1number: 6,
		nestedArray1null: null,
		nestedArray2: [{
			__typename: 'nested2',
			id: '1',
			nestedArray2string: 'This is a string too!',
			nestedArray2number: 6,
			nestedArray2null: null,
			nestedArray3: new Array(n).fill(0).map((_, index) => ({
				__typename: 'nested3',
				id: `${index + 1}`,
				nestedObj3string: `${index} This is a string also!`,
				nestedObj3number: 7 + index,
				nestedObj3null: null,
			}))
		}]
	}],
})

const benchmarks: { [key: string]: BenchmarkMaterial } = {
  '1 nested array': {
    query: gql`
			{
				id
				stringField
				numberField
				nullField
				nestedArray1 {
					id
					stringField
					numberField
					nullField
				}
			}
		`,
		result: {
			__typename: 'result',
			id: 'abcd',
			stringField: 'This is a string!',
			numberField: 5,
			nullField: null,
			nestedArray1: [
				{
					__typename: 'nested1',
					id: '1',
					stringField: 'This is a string too!',
					numberField: 6,
					nullField: null,
				},
			],
		}
  },
  '3 nested arrays with 1 element': {
    query: threeNestedArraysQuery,
		result: get3NestedArraysResult(1),
	},
  '3 nested arrays, 2000 elements in the deepest one': {
    query: threeNestedArraysQuery,
		result: get3NestedArraysResult(2000),
  },
};

async function runBenchmarks() {
	const benchs = await Promise.all(
		Object.entries(benchmarks).map(
			async ([bench, { query, result }]) => {
				const suite = new Benchmark.Suite(bench);

				suite
					.add("StoreWriter.writeToStore", {
						maxTime: 2,
						defer: true,
						fn(deferred: any) {
							const cache = writeQueryToStore({
								writer,
								query,
								result: cloneDeep(result),
							})

							return deferred.resolve(cache);
						}
					})
					// add listeners
					.on("cycle", (event: any) => {
						// eslint-disable-next-line no-console
						console.log(String(event.target));
					})
					.on("start", () => {
						// eslint-disable-next-line no-console
						console.log("Starting", bench);
					});

				return suite;
			}
		)
	);

	let benchRunning = 1;
	benchs.forEach((bench) =>
		bench.on("complete", () => {
			if (benchRunning < benchs.length) {
				benchs[benchRunning++].run();
			}
		})
	);
	if (benchs.length > 0) {
		benchs[0].run();
	} else {
		// eslint-disable-next-line
		console.log("No benchmarks to run");
	}
}

// eslint-disable-next-line
runBenchmarks().catch(console.error);
