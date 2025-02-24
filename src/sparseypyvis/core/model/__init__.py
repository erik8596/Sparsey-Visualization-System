'''
Model Structure:

Model
    Layer
        MAC (Macro-columns a.k.a "macs")
            CM (Competitive Modules a.k.a Minicolumns a.k.a "mincs")
                Neuron
'''

'''
Model Look:

Input Layer

Layer 1
    MAC 1
        CM 1
            Neuron [1 ... N]
        ...
        CM M
            Neuron [1 ... N]
    ...
    MAC N
        CM 1
            Neuron [1 ... N]
        ...
        CM M
            Neuron [1 ... N]

...
Layer N

'''