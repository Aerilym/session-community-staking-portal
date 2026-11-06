import {
  addHiddenNodeId,
  getHiddenNodeIdsForAddress,
  parseHiddenNodeIdsByAddress,
  removeHiddenNodeId,
  toggleHiddenNodeIdForAddress,
} from '../lib/hiddenNodes';

describe('hiddenNodes', () => {
  describe('addHiddenNodeId', () => {
    it('should add a node id to an empty list', () => {
      expect(addHiddenNodeId([], 1)).toEqual([1]);
    });

    it('should add a node id to the end of the list', () => {
      expect(addHiddenNodeId([1, 2], 3)).toEqual([1, 2, 3]);
    });

    it('should not duplicate an already hidden node id', () => {
      expect(addHiddenNodeId([1, 2], 2)).toEqual([1, 2]);
    });

    it('should not mutate the input list', () => {
      const ids = [1, 2];
      addHiddenNodeId(ids, 3);
      expect(ids).toEqual([1, 2]);
    });
  });

  describe('removeHiddenNodeId', () => {
    it('should remove a hidden node id', () => {
      expect(removeHiddenNodeId([1, 2, 3], 2)).toEqual([1, 3]);
    });

    it('should return an equivalent list when the node id is not hidden', () => {
      expect(removeHiddenNodeId([1, 2], 4)).toEqual([1, 2]);
    });

    it('should not mutate the input list', () => {
      const ids = [1, 2];
      removeHiddenNodeId(ids, 1);
      expect(ids).toEqual([1, 2]);
    });
  });

  describe('parseHiddenNodeIdsByAddress', () => {
    it('should parse a record of addresses to node ids', () => {
      expect(parseHiddenNodeIdsByAddress({ '0xa': [1, 2], '0xb': [3] })).toEqual({
        '0xa': [1, 2],
        '0xb': [3],
      });
    });

    it('should drop non-array entries and non-number ids', () => {
      expect(parseHiddenNodeIdsByAddress({ '0xa': [1, '2'], '0xb': 'nope', '0xc': 3 })).toEqual({
        '0xa': [1],
      });
    });

    it('should return an empty record for non-object values', () => {
      expect(parseHiddenNodeIdsByAddress(null)).toEqual({});
      expect(parseHiddenNodeIdsByAddress(undefined)).toEqual({});
      expect(parseHiddenNodeIdsByAddress([1, 2])).toEqual({});
      expect(parseHiddenNodeIdsByAddress('nope')).toEqual({});
    });
  });

  describe('getHiddenNodeIdsForAddress', () => {
    it('should get the hidden node ids for an address', () => {
      expect(getHiddenNodeIdsForAddress({ '0xa': [1, 2], '0xb': [3] }, '0xa')).toEqual([1, 2]);
    });

    it('should return an empty list for an address with no hidden nodes', () => {
      expect(getHiddenNodeIdsForAddress({ '0xa': [1] }, '0xb')).toEqual([]);
    });
  });

  describe('toggleHiddenNodeIdForAddress', () => {
    it('should hide a node id for the address only', () => {
      expect(toggleHiddenNodeIdForAddress({ '0xa': [1], '0xb': [2] }, '0xa', 3)).toEqual({
        '0xa': [1, 3],
        '0xb': [2],
      });
    });

    it('should unhide a node id for the address only', () => {
      expect(toggleHiddenNodeIdForAddress({ '0xa': [1, 2], '0xb': [2] }, '0xa', 1)).toEqual({
        '0xa': [2],
        '0xb': [2],
      });
    });

    it('should create an entry for an address with no hidden nodes', () => {
      expect(toggleHiddenNodeIdForAddress({}, '0xa', 1)).toEqual({ '0xa': [1] });
    });

    it('should not mutate the input record', () => {
      const record = { '0xa': [1] };
      toggleHiddenNodeIdForAddress(record, '0xa', 2);
      expect(record).toEqual({ '0xa': [1] });
    });
  });
});
