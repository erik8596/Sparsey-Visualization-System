// /static/js/factories/ElementFactoryProvider.js
import { MacFactory } from './MacFactory.js';
import { CmFactory } from './CMFactory.js';
import { NeuronFactory } from './NeuronFactory.js';

export function getElementFactory(type) {
  switch (type) {
    case 'mac':
      return new MacFactory();
    case 'cm':
      return new CmFactory();
    case 'neuron':
      return new NeuronFactory();
    default:
      return null;
  }
}
